import { TextHighlighter } from './text-highlighter';
import { ContentExtractor } from './content-extractor';
import { MessageType, Message, ManipulationAnalysis, AnalysisStatus } from '../shared/types';
import { sendMessage, onMessage } from '../shared/messaging';

class ContentScript {
  private textHighlighter: TextHighlighter;
  private contentExtractor: ContentExtractor;
  private currentAnalysis: ManipulationAnalysis | null = null;

  constructor() {
    this.textHighlighter = new TextHighlighter();
    this.contentExtractor = new ContentExtractor();
    this.setupMessageListeners();
    this.init();
  }

  private async init(): Promise<void> {
    sendMessage({
      type: MessageType.DEBUG,
      payload: {
        source: 'Content Script',
        message: 'Content script initialized',
        data: { url: window.location.href }
      }
    });

    // Check if auto-analyze is enabled
    try {
      const settings = await chrome.storage.sync.get(['autoAnalyze']);
      if (settings.autoAnalyze) {
        // Wait for page to be fully loaded
        if (document.readyState === 'complete') {
          this.analyzeCurrentPage();
        } else {
          window.addEventListener('load', () => {
            setTimeout(() => this.analyzeCurrentPage(), 1000);
          });
        }
      }
    } catch (error) {
      console.warn('Failed to check auto-analyze setting:', error);
    }
  }

  private setupMessageListeners(): void {
    onMessage((message: Message) => {
      switch (message.type) {
        case MessageType.ANALYZE_PAGE:
          this.handleAnalyzePage();
          break;
        
        case MessageType.ANALYZE_SELECTION:
          this.handleAnalyzeSelection();
          break;
        
        case MessageType.CLEAR_HIGHLIGHTS:
          this.handleClearHighlights();
          break;
        
        case MessageType.GET_ANALYSIS_STATUS:
          this.handleGetAnalysisStatus();
          break;
        
        case MessageType.UPDATE_SETTINGS:
          this.handleUpdateSettings(message.payload);
          break;
      }
    });
  }

  private async handleAnalyzePage(): Promise<void> {
    try {
      await this.analyzeCurrentPage();
    } catch (error) {
      console.error('Failed to analyze page:', error);
      this.sendAnalysisError('Failed to analyze page content');
    }
  }

  private async handleAnalyzeSelection(): Promise<void> {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        this.sendAnalysisError('No text selected');
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        this.sendAnalysisError('No text selected');
        return;
      }

      await this.analyzeText(selectedText);
    } catch (error) {
      console.error('Failed to analyze selection:', error);
      this.sendAnalysisError('Failed to analyze selected text');
    }
  }

  private handleClearHighlights(): void {
    this.textHighlighter.clearHighlights();
    this.currentAnalysis = null;
    
    sendMessage({
      type: MessageType.ANALYSIS_COMPLETE,
      payload: null
    });
  }

  private handleGetAnalysisStatus(): void {
    const status: AnalysisStatus = {
      state: this.currentAnalysis ? 'complete' : 'idle',
      lastAnalysis: this.currentAnalysis || undefined
    };

    sendMessage({
      type: MessageType.ANALYSIS_COMPLETE,
      payload: status
    });
  }

  private async handleUpdateSettings(settings: any): Promise<void> {
    if (settings.highlightMode) {
      this.textHighlighter.updateHighlightMode(settings.highlightMode);
    }
  }

  private async analyzeCurrentPage(): Promise<void> {
    try {
      const content = this.contentExtractor.extractContent();
      if (!content || !content.content.trim()) {
        this.sendAnalysisError('No content found on this page');
        return;
      }

      await this.analyzeText(content.content);
    } catch (error) {
      console.error('Failed to extract page content:', error);
      this.sendAnalysisError('Failed to extract page content');
    }
  }

  private async analyzeText(text: string): Promise<void> {
    try {
      // Send analysis request to background script
      const response = await sendMessage({
        type: MessageType.ANALYZE_PAGE,
        payload: { text }
      });

      if (response && response.analysis) {
        this.handleAnalysisComplete(response.analysis);
      } else {
        this.sendAnalysisError('No analysis results received');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      this.sendAnalysisError(error instanceof Error ? error.message : 'Analysis failed');
    }
  }

  private handleAnalysisComplete(analysis: ManipulationAnalysis): void {
    sendMessage({
      type: MessageType.DEBUG,
      payload: {
        source: 'Content Script',
        message: 'handleAnalysisComplete called',
        data: { analysis }
      }
    });
    this.currentAnalysis = analysis;
    
    // Get current settings for highlight mode
    chrome.storage.sync.get(['highlightMode']).then(settings => {
      const highlightMode = settings.highlightMode || 'full-color';
      
      // Apply highlights
      this.textHighlighter.highlightManipulations(
        analysis.manipulations,
        highlightMode
      );

      // Send completion message to popup/background
      sendMessage({
        type: MessageType.ANALYSIS_COMPLETE,
        payload: {
          state: 'complete',
          lastAnalysis: analysis
        }
      });
    }).catch(error => {
      console.warn('Failed to get highlight settings:', error);
      // Use default mode
      this.textHighlighter.highlightManipulations(
        analysis.manipulations,
        'full-color'
      );
    });
  }

  private sendAnalysisError(message: string): void {
    sendMessage({
      type: MessageType.ANALYSIS_ERROR,
      payload: { error: message }
    });
  }

  // Cleanup when page unloads
  private cleanup(): void {
    this.textHighlighter.clearHighlights();
    this.textHighlighter.removeStyles();
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScript();
  });
} else {
  new ContentScript();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Cleanup will be handled by the ContentScript instance
});