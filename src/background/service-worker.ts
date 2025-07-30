import { MessageType, Message, ManipulationAnalysis, LLMProvider } from '../shared/types';
import { SecureStorage } from '../shared/storage';
import { onMessage, sendMessageToTab } from '../shared/messaging';

class BackgroundService {
  private analysisInProgress = new Set<number>();

  constructor() {
    this.setupMessageListeners();
    this.setupContextMenus();
  }

  private setupMessageListeners(): void {
    onMessage(async (message: Message, sender, sendResponse) => {
      const tabId = sender?.tab?.id;
      
      try {
        switch (message.type) {
          case MessageType.ANALYZE_PAGE:
            if (tabId) {
              await this.handleAnalyzeRequest(tabId, message.payload?.text);
            }
            break;
          
          case MessageType.ANALYZE_SELECTION:
            if (tabId) {
              await this.handleAnalyzeRequest(tabId, message.payload?.selectedText);
            }
            break;
          
          case MessageType.GET_ANALYSIS_STATUS:
            if (tabId) {
              const isAnalyzing = this.analysisInProgress.has(tabId);
              sendResponse?.({ analyzing: isAnalyzing });
            }
            break;
        }
      } catch (error) {
        console.error('Background service error:', error);
        if (tabId) {
          this.sendAnalysisError(tabId, error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      return true; // Keep message channel open for async response
    });
  }

  private setupContextMenus(): void {
    chrome.runtime.onInstalled.addListener(() => {
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
    if (this.analysisInProgress.has(tabId)) {
      return; // Analysis already in progress for this tab
    }

    this.analysisInProgress.add(tabId);

    try {
      const settings = await SecureStorage.getSettings();
      const apiKey = await SecureStorage.getAPIKey(settings.provider);

      if (!apiKey) {
        throw new Error('API key not configured. Please set up your API key in the extension options.');
      }

      const analysis = await this.performAnalysis(text, settings.provider, apiKey, settings.model);
      
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
    if (provider === 'gemini') {
      return this.analyzeWithGemini(text, apiKey, model);
    }
    
    throw new Error(`Unsupported provider: ${provider}`);
  }

  private async analyzeWithGemini(text: string, apiKey: string, model: string): Promise<ManipulationAnalysis> {
    const prompt = this.buildAnalysisPrompt(text);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response generated from Gemini API');
    }

    return this.parseAnalysisResponse(generatedText);
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
  "model": "gemini-pro"
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
}

// Initialize the background service
new BackgroundService();