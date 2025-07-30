import { UserSettings, LLMProvider } from './types';
import { DEFAULT_SETTINGS } from './constants';

export class SecureStorage {
  private static readonly ENCRYPTION_KEY = 'manipulation-detector-key';
  
  static async storeAPIKey(provider: LLMProvider, apiKey: string): Promise<void> {
    const encrypted = this.obfuscate(apiKey);
    await chrome.storage.sync.set({
      [`apiKey_${provider}`]: encrypted
    });
  }

  static async getAPIKey(provider: LLMProvider): Promise<string | null> {
    const result = await chrome.storage.sync.get(`apiKey_${provider}`);
    const encrypted = result[`apiKey_${provider}`];
    
    return encrypted ? this.deobfuscate(encrypted) : null;
  }

  static async removeAPIKey(provider: LLMProvider): Promise<void> {
    await chrome.storage.sync.remove(`apiKey_${provider}`);
  }

  static async storeSettings(settings: UserSettings): Promise<void> {
    await chrome.storage.sync.set({
      userSettings: settings
    });
  }

  static async getSettings(): Promise<UserSettings> {
    const result = await chrome.storage.sync.get('userSettings');
    return { ...DEFAULT_SETTINGS, ...result.userSettings };
  }

  static async updateSetting<K extends keyof UserSettings>(
    key: K, 
    value: UserSettings[K]
  ): Promise<void> {
    const settings = await this.getSettings();
    settings[key] = value;
    await this.storeSettings(settings);
  }

  private static obfuscate(text: string): string {
    // Basic obfuscation - NOT secure encryption
    // For MVP only, warns users about security
    return btoa(text.split('').reverse().join(''));
  }

  private static deobfuscate(obfuscated: string): string {
    try {
      return atob(obfuscated).split('').reverse().join('');
    } catch {
      return '';
    }
  }

  static async hasValidAPIKey(provider: LLMProvider): Promise<boolean> {
    const apiKey = await this.getAPIKey(provider);
    return apiKey !== null && apiKey.length > 0;
  }

  static async clearAllData(): Promise<void> {
    await chrome.storage.sync.clear();
  }
}

// In-memory storage for analysis results (per tab)
export class AnalysisCache {
  private static cache = new Map<number, any>();
  
  static set(tabId: number, data: any): void {
    this.cache.set(tabId, {
      ...data,
      timestamp: Date.now()
    });
  }
  
  static get(tabId: number): any | null {
    const data = this.cache.get(tabId);
    if (!data) return null;
    
    // Cache expires after 10 minutes
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      this.cache.delete(tabId);
      return null;
    }
    
    return data;
  }
  
  static clear(tabId: number): void {
    this.cache.delete(tabId);
  }
  
  static clearAll(): void {
    this.cache.clear();
  }
}