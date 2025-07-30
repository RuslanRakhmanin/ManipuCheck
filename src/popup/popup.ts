import { MessageType, AnalysisStatus, ManipulationAnalysis } from '../shared/types';
import { sendMessage, onMessage } from '../shared/messaging';
import { SecureStorage } from '../shared/storage';
import { formatTimestamp } from '../shared/utils';
import { MANIPULATION_CATEGORIES } from '../shared/constants';

class PopupController {
  private elements: { [key: string]: HTMLElement } = {};
  private currentAnalysis: ManipulationAnalysis | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadSettings();
    this.checkAnalysisStatus();
  }

  private initializeElements(): void {
    const elementIds = [
      'statusIndicator', 'statusText', 'progressBar',
      'analyzePageBtn', 'analyzeSelectionBtn', 'clearHighlightsBtn',
      'resultsSection', 'errorSection', 'summaryStats', 'totalCount',
      'categoryBreakdown', 'analysisDate', 'errorMessage',
      'highlightMode', 'autoAnalyze', 'settingsBtn', 'optionsBtn',
      'helpBtn', 'aboutBtn', 'exportBtn', 'retryBtn'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements[id] = element;
      }
    });
  }

  private setupEventListeners(): void {
    // Action buttons
    this.elements.analyzePageBtn?.addEventListener('click', () => this.analyzePage());
    this.elements.analyzeSelectionBtn?.addEventListener('click', () => this.analyzeSelection());
    this.elements.clearHighlightsBtn?.addEventListener('click', () => this.clearHighlights());
    
    // Settings
    this.elements.highlightMode?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.updateHighlightMode(target.value as 'full-color' | 'low-contrast');
    });
    
    this.elements.autoAnalyze?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.updateAutoAnalyze(target.checked);
    });
    
    // Navigation buttons
    this.elements.settingsBtn?.addEventListener('click', () => this.openSettings());
    this.elements.optionsBtn?.addEventListener('click', () => this.openOptions());
    this.elements.helpBtn?.addEventListener('click', () => this.openHelp());
    this.elements.aboutBtn?.addEventListener('click', () => this.showAbout());
    
    // Action buttons
    this.elements.exportBtn?.addEventListener('click', () => this.exportResults());
    this.elements.retryBtn?.addEventListener('click', () => this.retryAnalysis());

    // Message listeners
    onMessage((message) => {
      switch (message.type) {
        case MessageType.ANALYSIS_COMPLETE:
          this.handleAnalysisComplete(message.payload);
          break;
        case MessageType.ANALYSIS_ERROR:
          this.handleAnalysisError(message.payload?.error);
          break;
      }
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await SecureStorage.getSettings();
      
      if (this.elements.highlightMode) {
        (this.elements.highlightMode as HTMLSelectElement).value = settings.highlightMode;
      }
      
      if (this.elements.autoAnalyze) {
        (this.elements.autoAnalyze as HTMLInputElement).checked = settings.autoAnalyze;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private async checkAnalysisStatus(): Promise<void> {
    try {
      const response = await sendMessage({
        type: MessageType.GET_ANALYSIS_STATUS
      });
      
      if (response?.analyzing) {
        this.setStatus('analyzing', 'Analyzing...');
      }
    } catch (error) {
      console.error('Failed to check analysis status:', error);
    }
  }

  private async analyzePage(): Promise<void> {
    try {
      this.setStatus('analyzing', 'Analyzing page...');
      this.showSection('none');
      
      await sendMessage({
        type: MessageType.ANALYZE_PAGE
      });
    } catch (error) {
      this.handleAnalysisError(error instanceof Error ? error.message : 'Failed to start analysis');
    }
  }

  private async analyzeSelection(): Promise<void> {
    try {
      this.setStatus('analyzing', 'Analyzing selection...');
      this.showSection('none');
      
      await sendMessage({
        type: MessageType.ANALYZE_SELECTION
      });
    } catch (error) {
      this.handleAnalysisError(error instanceof Error ? error.message : 'Failed to analyze selection');
    }
  }

  private async clearHighlights(): Promise<void> {
    try {
      await sendMessage({
        type: MessageType.CLEAR_HIGHLIGHTS
      });
      
      this.currentAnalysis = null;
      this.setStatus('idle', 'Ready to analyze');
      this.showSection('none');
    } catch (error) {
      console.error('Failed to clear highlights:', error);
    }
  }

  private handleAnalysisComplete(payload: any): void {
    if (payload?.lastAnalysis) {
      this.currentAnalysis = payload.lastAnalysis;
      if (this.currentAnalysis) {
        this.displayResults(this.currentAnalysis);
        this.setStatus('complete', `Found ${this.currentAnalysis.manipulations.length} issues`);
      }
    } else {
      this.setStatus('complete', 'Analysis complete - no issues found');
      this.showSection('none');
    }
  }

  private handleAnalysisError(error: string): void {
    this.setStatus('error', 'Analysis failed');
    this.showError(error);
  }

  private displayResults(analysis: ManipulationAnalysis): void {
    // Update summary stats
    if (this.elements.totalCount) {
      this.elements.totalCount.textContent = analysis.manipulations.length.toString();
    }
    
    if (this.elements.analysisDate) {
      this.elements.analysisDate.textContent = formatTimestamp(analysis.analysisDate);
    }

    // Update category breakdown
    this.updateCategoryBreakdown(analysis.manipulations);
    
    this.showSection('results');
  }

  private updateCategoryBreakdown(manipulations: any[]): void {
    if (!this.elements.categoryBreakdown) return;

    const categoryCounts: { [key: string]: number } = {};
    
    // Initialize all categories
    Object.keys(MANIPULATION_CATEGORIES).forEach(category => {
      categoryCounts[category] = 0;
    });
    
    // Count manipulations by category
    manipulations.forEach(manipulation => {
      for (const [category, types] of Object.entries(MANIPULATION_CATEGORIES)) {
        if (types.includes(manipulation.manipulation_type)) {
          categoryCounts[category]++;
          break;
        }
      }
    });

    // Generate HTML
    const html = Object.entries(categoryCounts)
      .map(([category, count]) => `
        <div class="category-item ${count > 0 ? 'has-issues' : ''}">
          <span class="category-name">${category}</span>
          <span class="category-count">${count}</span>
        </div>
      `).join('');

    this.elements.categoryBreakdown.innerHTML = html;
  }

  private showError(message: string): void {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    this.showSection('error');
  }

  private setStatus(state: 'idle' | 'analyzing' | 'complete' | 'error', text: string): void {
    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.className = `status-indicator ${state}`;
    }
    
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
    
    if (this.elements.progressBar) {
      if (state === 'analyzing') {
        this.elements.progressBar.classList.remove('hidden');
      } else {
        this.elements.progressBar.classList.add('hidden');
      }
    }
  }

  private showSection(section: 'results' | 'error' | 'none'): void {
    this.elements.resultsSection?.classList.toggle('hidden', section !== 'results');
    this.elements.errorSection?.classList.toggle('hidden', section !== 'error');
  }

  private async updateHighlightMode(mode: 'full-color' | 'low-contrast'): Promise<void> {
    try {
      await SecureStorage.updateSetting('highlightMode', mode);
      
      // Notify content script
      await sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: { highlightMode: mode }
      });
    } catch (error) {
      console.error('Failed to update highlight mode:', error);
    }
  }

  private async updateAutoAnalyze(enabled: boolean): Promise<void> {
    try {
      await SecureStorage.updateSetting('autoAnalyze', enabled);
    } catch (error) {
      console.error('Failed to update auto-analyze setting:', error);
    }
  }

  private openSettings(): void {
    chrome.runtime.openOptionsPage();
  }

  private openOptions(): void {
    chrome.runtime.openOptionsPage();
  }

  private openHelp(): void {
    chrome.tabs.create({
      url: 'https://github.com/your-username/manipucheck#help'
    });
  }

  private showAbout(): void {
    const aboutText = `
ManipuCheck v1.0.0

An AI-powered browser extension that identifies manipulative text patterns in web content.

Features:
• Real-time manipulation detection
• Multiple manipulation categories
• Customizable highlighting
• Export analysis results

Built with privacy in mind - your data stays local.
    `.trim();
    
    alert(aboutText);
  }

  private exportResults(): void {
    if (!this.currentAnalysis) return;

    const data = {
      analysis: this.currentAnalysis,
      exportDate: new Date().toISOString(),
      url: window.location.href
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `manipucheck-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  private retryAnalysis(): void {
    this.analyzePage();
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});