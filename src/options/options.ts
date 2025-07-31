import { SecureStorage } from '../shared/storage';
import { UserSettings, LLMProvider } from '../shared/types';
import { DEFAULT_SETTINGS, GEMINI_MODELS, SUPPORTED_LANGUAGES } from '../shared/constants';
import { validateApiKey } from '../shared/utils';

class OptionsController {
  private elements: { [key: string]: HTMLElement } = {};
  private currentSettings: UserSettings = DEFAULT_SETTINGS;
  private saveTimeout: number | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadSettings();
    this.populateSelects();
  }

  private initializeElements(): void {
    const elementIds = [
      'provider', 'model', 'apiKey', 'toggleApiKey', 'apiKeyStatus',
      'language', 'autoAnalyze', 'highlightMode', 'saveStatus',
      'saveSettings', 'resetDefaults', 'clearAllData'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements[id] = element;
      }
    });
  }

  private setupEventListeners(): void {
    // API Key toggle
    this.elements.toggleApiKey?.addEventListener('click', () => this.toggleApiKeyVisibility());
    
    // API Key validation
    this.elements.apiKey?.addEventListener('input', () => this.validateApiKey());
    this.elements.apiKey?.addEventListener('blur', () => this.validateApiKey());
    
    // Auto-save on changes
    const autoSaveElements = ['provider', 'model', 'language', 'autoAnalyze', 'highlightMode'];
    autoSaveElements.forEach(id => {
      this.elements[id]?.addEventListener('change', () => this.autoSave());
    });
    
    // Manual save
    this.elements.saveSettings?.addEventListener('click', () => this.saveSettings());
    
    // Reset defaults
    this.elements.resetDefaults?.addEventListener('click', () => this.resetToDefaults());
    
    // Clear all data
    this.elements.clearAllData?.addEventListener('click', () => this.clearAllData());
    
    // Provider change updates model options
    this.elements.provider?.addEventListener('change', () => this.updateModelOptions());
    
    // Highlight mode preview update
    this.elements.highlightMode?.addEventListener('change', () => this.updateHighlightPreview());
  }

  private populateSelects(): void {
    // Populate model select
    this.updateModelOptions();
    
    // Populate language select
    if (this.elements.language) {
      const languageSelect = this.elements.language as HTMLSelectElement;
      languageSelect.innerHTML = SUPPORTED_LANGUAGES
        .map(lang => `<option value="${lang.code}">${lang.name}</option>`)
        .join('');
    }
  }

  private updateModelOptions(): void {
    if (!this.elements.model) return;
    
    const modelSelect = this.elements.model as HTMLSelectElement;
    const provider = (this.elements.provider as HTMLSelectElement)?.value as LLMProvider;
    
    if (provider === 'gemini') {
      modelSelect.innerHTML = GEMINI_MODELS
        .map(model => `<option value="${model.value}">${model.label}</option>`)
        .join('');
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      this.currentSettings = await SecureStorage.getSettings();
      
      // Load API key
      const apiKey = await SecureStorage.getAPIKey(this.currentSettings.provider);
      
      // Populate form
      this.populateForm(this.currentSettings, apiKey);
      
      // Update preview
      this.updateHighlightPreview();
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showSaveStatus('Failed to load settings', 'error');
    }
  }

  private populateForm(settings: UserSettings, apiKey: string | null): void {
    const elements = this.elements;
    
    if (elements.provider) {
      (elements.provider as HTMLSelectElement).value = settings.provider;
    }
    
    if (elements.model) {
      (elements.model as HTMLSelectElement).value = settings.model;
    }
    
    if (elements.apiKey && apiKey) {
      (elements.apiKey as HTMLInputElement).value = apiKey;
    }
    
    if (elements.language) {
      (elements.language as HTMLSelectElement).value = settings.language;
    }
    
    if (elements.autoAnalyze) {
      (elements.autoAnalyze as HTMLInputElement).checked = settings.autoAnalyze;
    }
    
    if (elements.highlightMode) {
      (elements.highlightMode as HTMLSelectElement).value = settings.highlightMode;
    }
  }

  private toggleApiKeyVisibility(): void {
    const apiKeyInput = this.elements.apiKey as HTMLInputElement;
    const toggleButton = this.elements.toggleApiKey;
    
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    } else {
      apiKeyInput.type = 'password';
      toggleButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
  }

  private async validateApiKey(): Promise<void> {
    const apiKeyInput = this.elements.apiKey as HTMLInputElement;
    const statusElement = this.elements.apiKeyStatus;
    
    if (!statusElement) return;
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      statusElement.className = 'api-key-status';
      statusElement.textContent = '';
      return;
    }
    
    // Show checking status
    statusElement.className = 'api-key-status checking';
    statusElement.textContent = 'Validating API key...';
    
    try {
      // Basic format validation
      if (!validateApiKey(apiKey)) {
        statusElement.className = 'api-key-status invalid';
        statusElement.textContent = 'Invalid API key format';
        return;
      }
      
      // Test API key with a simple request
      const isValid = await this.testApiKey(apiKey);
      
      if (isValid) {
        statusElement.className = 'api-key-status valid';
        statusElement.textContent = 'API key is valid';
      } else {
        statusElement.className = 'api-key-status invalid';
        statusElement.textContent = 'API key is invalid or expired';
      }
    } catch (error) {
      statusElement.className = 'api-key-status invalid';
      statusElement.textContent = 'Failed to validate API key';
    }
  }

  private async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private autoSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = window.setTimeout(() => {
      this.saveSettings(false);
    }, 1000);
  }

  private async saveSettings(showStatus: boolean = true): Promise<void> {
    try {
      const formData = this.getFormData();
      
      // Save settings
      await SecureStorage.storeSettings(formData.settings);
      
      // Save API key if provided
      if (formData.apiKey) {
        await SecureStorage.storeAPIKey(formData.settings.provider, formData.apiKey);
      }
      
      this.currentSettings = formData.settings;
      
      if (showStatus) {
        this.showSaveStatus('Settings saved successfully', 'success');
      }
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showSaveStatus('Failed to save settings', 'error');
    }
  }

  private getFormData(): { settings: UserSettings; apiKey: string } {
    const elements = this.elements;
    
    const settings: UserSettings = {
      provider: (elements.provider as HTMLSelectElement)?.value as LLMProvider || 'gemini',
      model: (elements.model as HTMLSelectElement)?.value || 'gemini-pro',
      language: (elements.language as HTMLSelectElement)?.value || 'en',
      highlightMode: (elements.highlightMode as HTMLSelectElement)?.value as 'full-color' | 'low-contrast' || 'full-color',
      autoAnalyze: (elements.autoAnalyze as HTMLInputElement)?.checked || false
    };
    
    const apiKey = (elements.apiKey as HTMLInputElement)?.value?.trim() || '';
    
    return { settings, apiKey };
  }

  private async resetToDefaults(): Promise<void> {
    if (!confirm('Are you sure you want to reset all settings to defaults? This will not affect your API key.')) {
      return;
    }
    
    try {
      await SecureStorage.storeSettings(DEFAULT_SETTINGS);
      this.currentSettings = DEFAULT_SETTINGS;
      this.populateForm(DEFAULT_SETTINGS, null);
      this.updateHighlightPreview();
      this.showSaveStatus('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showSaveStatus('Failed to reset settings', 'error');
    }
  }

  private async clearAllData(): Promise<void> {
    const confirmText = 'Are you sure you want to clear ALL data? This will remove:\n\n• All settings\n• API keys\n• Cached analysis results\n\nThis action cannot be undone.';
    
    if (!confirm(confirmText)) {
      return;
    }
    
    try {
      await SecureStorage.clearAllData();
      
      // Reset form
      this.currentSettings = DEFAULT_SETTINGS;
      this.populateForm(DEFAULT_SETTINGS, null);
      this.updateHighlightPreview();
      
      // Clear API key status
      if (this.elements.apiKeyStatus) {
        this.elements.apiKeyStatus.className = 'api-key-status';
        this.elements.apiKeyStatus.textContent = '';
      }
      
      this.showSaveStatus('All data cleared successfully', 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showSaveStatus('Failed to clear data', 'error');
    }
  }

  private updateHighlightPreview(): void {
    const highlightMode = (this.elements.highlightMode as HTMLSelectElement)?.value || 'full-color';
    const previewElements = document.querySelectorAll('.preview-highlight');
    
    previewElements.forEach(element => {
      element.classList.remove('full-color', 'low-contrast');
      element.classList.add(highlightMode);
    });
  }

  private showSaveStatus(message: string, type: 'success' | 'error'): void {
    const statusElement = this.elements.saveStatus;
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `save-status ${type}`;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'save-status';
    }, 3000);
  }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});