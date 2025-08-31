import { GoogleGenAI } from "@google/genai";
import { AnalysisError } from "../shared/types";
import { MessageType, Message, ManipulationAnalysis, LLMProvider } from '../shared/types';
import { SecureStorage } from '../shared/storage';
import { onMessage, sendMessageToTab } from '../shared/messaging';
import { debugLog } from '../shared/debug';

class BackgroundService {
  private analysisInProgress = new Set<number>();

  constructor() {
    this.setupMessageListeners();
    this.setupContextMenus();
  }

private setupMessageListeners(): void {
  onMessage(async (message: Message, sender, sendResponse) => {
    let tabId = sender?.tab?.id;

    // If tabId is not available from sender (e.g., from popup), get the active tab
    if (tabId === undefined) {
      tabId = await this.getActiveTabId();
      if (tabId === undefined) {
        // console.error('Could not determine active tab ID.');
        debugLog('Service Worker', 'Could not determine active tab ID.');
        return true; // Return true to keep message channel open
      }
    }
    
    try {
      switch (message.type) {
        case MessageType.ANALYZE_PAGE:
          debugLog('Service Worker', 'Received ANALYZE_PAGE message from ' + tabId);
          await this.handleAnalyzeRequest(tabId, message.payload?.text);
          break;
        
        case MessageType.ANALYZE_SELECTION:
          debugLog('Service Worker', 'Received ANALYZE_SELECTION message from ' + tabId + ': ' + message.payload?.selectedText);
          await this.handleAnalyzeRequest(tabId, message.payload?.selectedText);
          break;
        
        case MessageType.GET_ANALYSIS_STATUS:
          const isAnalyzing = this.analysisInProgress.has(tabId);
          sendResponse?.({ analyzing: isAnalyzing });
          break;

        case MessageType.DEBUG:
          if (message.payload) {
            const { source, message: msg, data } = message.payload;
            debugLog(source, msg, data);
          }
          break;
      }
    } catch (error) {
      console.error('Background service error:', error);
      this.sendAnalysisError(tabId, error instanceof Error ? error.message : 'Unknown error');
    }
    
    return true; // Keep message channel open for async response
  });
}

  private setupContextMenus(): void {
    chrome.runtime.onInstalled.addListener(() => {
      debugLog('Service Worker', 'Extension installed or updated.');
      chrome.contextMenus.create({
        id: 'analyze-selection',
        title: 'Analyze selected text for manipulation',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'analyze-page',
        title: 'Analyze entire page for manipulation',
        contexts: ['page']
      });
    });

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (!tab?.id) return;
      debugLog('Service Worker', 'Context menu clicked on tab', { tabId: tab.id, info });

      try {
        switch (info.menuItemId) {
          case 'analyze-selection':
            await sendMessageToTab(tab.id, {
              type: MessageType.ANALYZE_SELECTION
            });
            break;
          
          case 'analyze-page':
            await sendMessageToTab(tab.id, {
              type: MessageType.ANALYZE_PAGE
            });
            break;
        }
      } catch (error) {
        console.error('Context menu action failed:', error);
      }
    });
  }

  private async handleAnalyzeRequest(tabId: number, text: string): Promise<void> {
    debugLog('Service Worker', 'handleAnalyzeRequest started', { tabId });
    if (this.analysisInProgress.has(tabId)) {
      debugLog('Service Worker', 'Analysis already in progress for this tab', { tabId });
      return; // Analysis already in progress for this tab
    }

    this.analysisInProgress.add(tabId);

    try {
      const settings = await SecureStorage.getSettings();
      debugLog('Service Worker', 'Got settings', { settings });
      const apiKey = await SecureStorage.getAPIKey(settings.provider);

      if (!apiKey) {
        throw new Error('API key not configured. Please set up your API key in the extension options.');
      }

      const analysis = await this.performAnalysis(text, settings.provider, apiKey, settings.model);
      debugLog('Service Worker', 'Analysis complete, sending to tab', { tabId, analysis });
      
      await sendMessageToTab(tabId, {
        type: MessageType.ANALYSIS_COMPLETE,
        payload: { analysis }
      });

    } catch (error) {
      console.error('Analysis failed:', error);
      this.sendAnalysisError(tabId, error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      this.analysisInProgress.delete(tabId);
    }
  }

  private async performAnalysis(
    text: string, 
    provider: LLMProvider, 
    apiKey: string, 
    model: string
  ): Promise<ManipulationAnalysis> {
    debugLog('Service Worker', 'performAnalysis started', { provider, model });
    if (provider === 'gemini') {
      return this.analyzeWithGemini(text, apiKey, model);
    }
    
    throw new Error(`Unsupported provider: ${provider}`);
  }

  private async analyzeWithGemini(text: string, apiKey: string, model: string): Promise<ManipulationAnalysis> {
    debugLog('Service Worker', 'analyzeWithGemini started' + ' model:' + model);
    const prompt = this.buildAnalysisPrompt(text);
    debugLog('Service Worker', 'Generated prompt for Gemini', { prompt });
    const ai = new GoogleGenAI({ apiKey });

    try {
      const result = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: {
            includeThoughts: false
          }
        }
      });
      const generatedText = result.text;
      debugLog('Service Worker', 'Got response from Gemini', { generatedText });

      if (!generatedText) {
        throw new Error('No response generated from Gemini API');
      }

      return this.parseAnalysisResponse(generatedText);
    } catch (error: unknown) {
      debugLog('Service Worker', 'Error occurred while analyzing with Gemini', { error });
      throw new AnalysisError('Failed to get or parse Gemini API response', error instanceof Error ? error : undefined);
    }
  }

  private buildAnalysisPrompt(text: string): string {
    return `Analyze the following text for manipulative patterns and techniques. Return your analysis as a JSON object with the following structure:

{
  "manipulations": [
    {
      "original_text": "exact text snippet that contains manipulation",
      "manipulation_type": "one of: fear_mongering, outrage_bait, emotional_appeal, strawman, ad_hominem, false_dichotomy, slippery_slope, cherry_picking, misleading_statistics, false_correlation, quote_mining, bandwagon, authority_appeal, loaded_language, repetition, headline_mismatch, buried_lede, false_balance",
      "manipulation_description": "brief explanation of why this is manipulative",
      "confidence": 0.85
    }
  ],
  "analysisDate": "${new Date().toISOString()}",
  "provider": "gemini",
  "model": "exact model that was used to process this request"
}

Focus on identifying:
1. Emotional manipulation (fear-mongering, outrage bait, emotional appeals)
2. Logical fallacies (strawman arguments, ad hominem attacks, false dichotomies)
3. Information distortion (cherry-picking, misleading statistics, false correlations)
4. Persuasion techniques (bandwagon effects, authority appeals, loaded language)
5. Structural manipulation (headline mismatches, buried leads, false balance)

Only include manipulations you're confident about (confidence > 0.6). Be precise with the original_text field - it should contain the exact text that demonstrates the manipulation.

Text to analyze:
${text}`;
  }

  private parseAnalysisResponse(response: string): ManipulationAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      if (!parsed.manipulations || !Array.isArray(parsed.manipulations)) {
        throw new Error('Invalid response format: missing manipulations array');
      }

      // Validate each manipulation
      parsed.manipulations = parsed.manipulations.filter((manipulation: any) => {
        return manipulation.original_text && 
               manipulation.manipulation_type && 
               manipulation.manipulation_description &&
               typeof manipulation.confidence === 'number';
      });

      return {
        manipulations: parsed.manipulations,
        analysisDate: parsed.analysisDate || new Date().toISOString(),
        provider: parsed.provider || 'gemini',
        model: parsed.model || 'gemini-pro'
      };

    } catch (error) {
      console.error('Failed to parse analysis response:', error);
      console.error('Raw response:', response);
      
      // Return empty analysis rather than failing completely
      return {
        manipulations: [],
        analysisDate: new Date().toISOString(),
        provider: 'gemini',
        model: 'gemini-pro'
      };
    }
  }

private async sendAnalysisError(tabId: number, message: string): Promise<void> {
    try {
      await sendMessageToTab(tabId, {
        type: MessageType.ANALYSIS_ERROR,
        payload: { error: message }
      });
    } catch (error) {
      console.error('Failed to send error message to tab:', error);
    }
  }

  private async getActiveTabId(): Promise<number | undefined> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id;
  }
}

// Initialize the background service
new BackgroundService();