import { ManipulationBlock, AnalysisResult } from './types';
import { MANIPULATION_CATEGORIES } from './constants';

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function formatAnalysisResult(manipulations: ManipulationBlock[]): AnalysisResult {
  const byCategory: Record<string, number> = {};
  
  // Initialize categories
  Object.keys(MANIPULATION_CATEGORIES).forEach(category => {
    byCategory[category] = 0;
  });
  
  // Count manipulations by category
  manipulations.forEach(manipulation => {
    for (const [category, types] of Object.entries(MANIPULATION_CATEGORIES)) {
      if (types.includes(manipulation.manipulation_type)) {
        byCategory[category]++;
        break;
      }
    }
  });
  
  return {
    manipulations,
    totalCount: manipulations.length,
    byCategory,
    analysisDate: new Date().toISOString()
  };
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
}

export function validateApiKey(apiKey: string): boolean {
  // Basic validation for Gemini API key format
  return apiKey.length > 20 && apiKey.startsWith('AI');
}

export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

export function createId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}