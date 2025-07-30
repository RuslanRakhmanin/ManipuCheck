# Text Manipulation Detector - Technical Design Document (TDD)

## System Architecture Overview

### High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Content       │    │    Background    │    │   LLM Provider  │
│   Script        │◄──►│    Service       │◄──►│   (Gemini API)  │
│                 │    │    Worker        │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                       ▲
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   DOM           │    │    Extension     │
│   Manipulation  │    │    Popup         │
│                 │    │    (React)       │
└─────────────────┘    └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │    Settings      │
                       │    Page          │
                       │    (React)       │
                       └──────────────────┘
```

### Component Breakdown

**1. Background Service Worker**
- Manages LLM API communication
- Handles cross-origin requests
- Stores analysis results in memory
- Coordinates between popup and content script

**2. Content Script**
- Extracts article content from web pages
- Highlights manipulative text blocks
- Displays tooltips on hover
- Handles text selection events

**3. Extension Popup (React)**
- User interface for triggering analysis
- Displays analysis status and results summary
- Navigation to settings

**4. Settings Page (React)**
- LLM provider and model configuration
- API key management
- Display preferences

**5. DOM Manipulation Module**
- Text highlighting system
- Tooltip positioning and display
- Range-to-DOM element matching

## Project Structure

```
src/
├── manifest.json
├── background/
│   ├── service-worker.ts
│   ├── llm-client.ts
│   ├── analysis-manager.ts
│   └── message-handler.ts
├── content/
│   ├── content-script.ts
│   ├── content-extractor.ts
│   ├── text-highlighter.ts
│   ├── tooltip-manager.ts
│   └── text-matcher.ts
├── popup/
│   ├── index.html
│   ├── popup.tsx
│   ├── components/
│   │   ├── AnalysisButton.tsx
│   │   ├── ResultsSummary.tsx
│   │   └── StatusIndicator.tsx
│   └── hooks/
│       ├── useAnalysis.ts
│       └── useSettings.ts
├── options/
│   ├── options.html
│   ├── options.tsx
│   └── components/
│       ├── LLMConfig.tsx
│       ├── DisplaySettings.tsx
│       └── SecurityWarnings.tsx
├── shared/
│   ├── types.ts
│   ├── constants.ts
│   ├── utils.ts
│   ├── storage.ts
│   └── messaging.ts
└── assets/
    ├── icons/
    └── styles/
```

## Core Technical Components

### 1. Content Extraction System

**Implementation Strategy**: Use Mozilla's Readability.js algorithm (similar to what Google uses for summarization) for reliable article extraction.

```typescript
// content/content-extractor.ts
import { Readability } from '@mozilla/readability';

export class ContentExtractor {
  private readability: Readability;
  
  constructor(private document: Document) {
    this.readability = new Readability(document.cloneNode(true) as Document);
  }

  extractMainContent(): ExtractedContent | null {
    const article = this.readability.parse();
    
    if (!article) {
      return this.fallbackExtraction();
    }

    return {
      title: article.title,
      content: article.textContent,
      htmlContent: article.content,
      wordCount: this.countWords(article.textContent),
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
  }

  private fallbackExtraction(): ExtractedContent | null {
    // Fallback selectors for common article patterns
    const selectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#main-content'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && this.isContentElement(element)) {
        return this.extractFromElement(element);
      }
    }

    return null;
  }

  private isContentElement(element: Element): boolean {
    const text = element.textContent || '';
    const wordCount = this.countWords(text);
    
    // Basic heuristics for content detection
    return wordCount > 100 && 
           text.length > 500 &&
           !element.classList.contains('sidebar') &&
           !element.classList.contains('advertisement');
  }

  convertToMarkdown(htmlContent: string): string {
    // Convert HTML to clean Markdown for LLM processing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Remove unwanted elements
    const unwantedSelectors = ['script', 'style', 'iframe', '.ad', '.advertisement'];
    unwantedSelectors.forEach(selector => {
      tempDiv.querySelectorAll(selector).forEach(el => el.remove());
    });

    return this.htmlToMarkdown(tempDiv);
  }

  private htmlToMarkdown(element: Element): string {
    // Simplified HTML to Markdown conversion
    // For production, consider using a library like turndown
    let markdown = '';
    
    element.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        
        switch (tagName) {
          case 'h1':
          case 'h2':
          case 'h3':
            markdown += `\n${'#'.repeat(parseInt(tagName[1]))} ${el.textContent}\n`;
            break;
          case 'p':
            markdown += `\n${el.textContent}\n`;
            break;
          case 'strong':
          case 'b':
            markdown += `**${el.textContent}**`;
            break;
          case 'em':
          case 'i':
            markdown += `*${el.textContent}*`;
            break;
          default:
            markdown += this.htmlToMarkdown(el);
        }
      }
    });

    return markdown.trim();
  }
}
```

### 2. Text Matching System

**Problem**: Match LLM-identified text spans back to DOM elements for highlighting.

**Solution**: Create a text position mapping system that handles whitespace normalization and text node traversal.

```typescript
// content/text-matcher.ts
export class TextMatcher {
  private textNodes: Text[] = [];
  private textPositionMap: TextPositionMap[] = [];
  
  constructor(private rootElement: Element) {
    this.buildTextNodeMap();
  }

  private buildTextNodeMap(): void {
    const walker = document.createTreeWalker(
      this.rootElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent?.trim();
          return text && text.length > 0 
            ? NodeFilter.FILTER_ACCEPT 
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let globalOffset = 0;
    let node: Text | null;
    
    while (node = walker.nextNode() as Text) {
      const normalizedText = this.normalizeText(node.textContent || '');
      
      this.textPositionMap.push({
        node,
        startOffset: globalOffset,
        endOffset: globalOffset + normalizedText.length,
        normalizedText
      });
      
      this.textNodes.push(node);
      globalOffset += normalizedText.length;
    }
  }

  findTextRanges(targetText: string): DOMRange[] {
    const normalizedTarget = this.normalizeText(targetText);
    const ranges: DOMRange[] = [];

    // Search for the normalized text in our position map
    const fullText = this.textPositionMap
      .map(item => item.normalizedText)
      .join('');
    
    let searchStart = 0;
    let matchIndex: number;
    
    while ((matchIndex = fullText.indexOf(normalizedTarget, searchStart)) !== -1) {
      const range = this.createDOMRange(matchIndex, matchIndex + normalizedTarget.length);
      if (range) {
        ranges.push(range);
      }
      searchStart = matchIndex + 1;
    }

    return ranges;
  }

  private createDOMRange(startPos: number, endPos: number): DOMRange | null {
    const startLocation = this.findNodeAtPosition(startPos);
    const endLocation = this.findNodeAtPosition(endPos - 1);
    
    if (!startLocation || !endLocation) {
      return null;
    }

    const range = document.createRange();
    range.setStart(startLocation.node, startLocation.offset);
    range.setEnd(endLocation.node, endLocation.offset + 1);
    
    return {
      range,
      originalText: range.toString(),
      normalizedText: this.normalizeText(range.toString())
    };
  }

  private findNodeAtPosition(position: number): NodeLocation | null {
    for (const mapItem of this.textPositionMap) {
      if (position >= mapItem.startOffset && position < mapItem.endOffset) {
        const relativeOffset = position - mapItem.startOffset;
        return {
          node: mapItem.node,
          offset: this.denormalizeOffset(mapItem.node.textContent || '', relativeOffset)
        };
      }
    }
    return null;
  }

  private normalizeText(text: string): string {
    // Normalize whitespace and remove extra spaces
    return text.replace(/\s+/g, ' ').trim();
  }

  private denormalizeOffset(originalText: string, normalizedOffset: number): number {
    // Convert normalized position back to original text position
    let originalPos = 0;
    let normalizedPos = 0;
    
    for (let i = 0; i < originalText.length && normalizedPos < normalizedOffset; i++) {
      const char = originalText[i];
      
      if (/\s/.test(char)) {
        // Skip consecutive whitespace in normalization
        if (i === 0 || !/\s/.test(originalText[i - 1])) {
          normalizedPos++;
        }
      } else {
        normalizedPos++;
      }
      
      originalPos = i + 1;
    }
    
    return originalPos;
  }
}

interface TextPositionMap {
  node: Text;
  startOffset: number;
  endOffset: number;
  normalizedText: string;
}

interface NodeLocation {
  node: Text;
  offset: number;
}

interface DOMRange {
  range: Range;
  originalText: string;
  normalizedText: string;
}
```

### 3. Text Highlighting System

```typescript
// content/text-highlighter.ts
export class TextHighlighter {
  private static readonly HIGHLIGHT_CLASS_PREFIX = 'manipulation-highlight';
  private static readonly TOOLTIP_CLASS = 'manipulation-tooltip';
  
  private highlightedRanges: Map<string, HighlightInfo[]> = new Map();
  private tooltipManager: TooltipManager;

  constructor() {
    this.tooltipManager = new TooltipManager();
    this.injectStyles();
  }

  highlightManipulations(manipulations: ManipulationBlock[], mode: HighlightMode): void {
    this.clearHighlights();
    
    manipulations.forEach((manipulation, index) => {
      this.highlightManipulation(manipulation, index, mode);
    });
  }

  private highlightManipulation(
    manipulation: ManipulationBlock, 
    index: number, 
    mode: HighlightMode
  ): void {
    const textMatcher = new TextMatcher(document.body);
    const ranges = textMatcher.findTextRanges(manipulation.original_text);
    
    ranges.forEach(domRange => {
      const highlightId = `highlight-${index}-${Date.now()}`;
      const highlightElement = this.createHighlightElement(
        domRange.range, 
        manipulation, 
        highlightId, 
        mode
      );
      
      if (highlightElement) {
        this.registerHighlight(highlightId, {
          element: highlightElement,
          manipulation,
          range: domRange.range
        });
      }
    });
  }

  private createHighlightElement(
    range: Range, 
    manipulation: ManipulationBlock, 
    highlightId: string, 
    mode: HighlightMode
  ): HTMLElement | null {
    try {
      const span = document.createElement('span');
      span.id = highlightId;
      span.className = this.getHighlightClass(manipulation.manipulation_type, mode);
      span.setAttribute('data-manipulation-type', manipulation.manipulation_type);
      span.setAttribute('data-manipulation-description', manipulation.manipulation_description);
      
      // Event listeners for tooltip
      span.addEventListener('mouseenter', (e) => {
        this.tooltipManager.showTooltip(e.target as HTMLElement, manipulation);
      });
      
      span.addEventListener('mouseleave', () => {
        this.tooltipManager.hideTooltip();
      });
      
      // Wrap the range content
      range.surroundContents(span);
      
      return span;
    } catch (error) {
      console.warn('Failed to highlight text range:', error);
      return null;
    }
  }

  private getHighlightClass(manipulationType: ManipulationType, mode: HighlightMode): string {
    const baseClass = `${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-${manipulationType}`;
    const modeClass = mode === 'low-contrast' ? 'low-contrast' : 'full-color';
    return `${baseClass} ${modeClass}`;
  }

  private injectStyles(): void {
    if (document.getElementById('manipulation-detector-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'manipulation-detector-styles';
    style.textContent = `
      /* Full color mode */
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-fear_mongering.full-color {
        background-color: rgba(255, 107, 107, 0.3);
        border-bottom: 2px solid #FF6B6B;
      }
      
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-strawman.full-color {
        background-color: rgba(255, 179, 71, 0.3);
        border-bottom: 2px solid #FFB347;
      }
      
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-cherry_picking.full-color {
        background-color: rgba(255, 217, 61, 0.3);
        border-bottom: 2px solid #FFD93D;
      }
      
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-bandwagon.full-color {
        background-color: rgba(107, 206, 255, 0.3);
        border-bottom: 2px solid #6BCEFF;
      }
      
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-headline_mismatch.full-color {
        background-color: rgba(177, 156, 217, 0.3);
        border-bottom: 2px solid #B19CD9;
      }

      /* Low contrast mode */
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-fear_mongering.low-contrast,
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-strawman.low-contrast,
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-cherry_picking.low-contrast,
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-bandwagon.low-contrast,
      .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-headline_mismatch.low-contrast {
        background-color: rgba(128, 128, 128, 0.15);
        border-bottom: 1px dotted #888;
      }

      /* Common styles */
      [class*="${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}"] {
        cursor: help;
        transition: background-color 0.2s ease;
      }
      
      [class*="${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}"]:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }
    `;
    
    document.head.appendChild(style);
  }

  clearHighlights(): void {
    this.highlightedRanges.forEach(highlights => {
      highlights.forEach(highlight => {
        const parent = highlight.element.parentNode;
        if (parent) {
          // Move children out of highlight span
          while (highlight.element.firstChild) {
            parent.insertBefore(highlight.element.firstChild, highlight.element);
          }
          parent.removeChild(highlight.element);
        }
      });
    });
    
    this.highlightedRanges.clear();
    this.tooltipManager.hideTooltip();
  }

  private registerHighlight(id: string, info: HighlightInfo): void {
    const pageUrl = window.location.href;
    if (!this.highlightedRanges.has(pageUrl)) {
      this.highlightedRanges.set(pageUrl, []);
    }
    this.highlightedRanges.get(pageUrl)!.push(info);
  }
}

interface HighlightInfo {
  element: HTMLElement;
  manipulation: ManipulationBlock;
  range: Range;
}

type HighlightMode = 'full-color' | 'low-contrast';
```

### 4. LLM Integration

```typescript
// background/llm-client.ts
export class LLMClient {
  private apiKey: string;
  private provider: LLMProvider;
  private model: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.provider = config.provider;
    this.model = config.model;
  }

  async analyzeText(content: string, language: string): Promise<ManipulationAnalysis> {
    const prompt = this.buildAnalysisPrompt(content, language);
    
    try {
      const response = await this.callAPI(prompt);
      return this.parseResponse(response);
    } catch (error) {
      throw new AnalysisError(`LLM analysis failed: ${error.message}`, error);
    }
  }

  private buildAnalysisPrompt(content: string, language: string): string {
    return `
Analyze the following text for manipulative language patterns. Return a JSON array of manipulation blocks found.

For each manipulation found, provide:
- original_text: The exact text that contains manipulation
- manipulation_type: One of [${MANIPULATION_TYPES.join(', ')}]
- manipulation_description: Brief explanation in ${language} language
- confidence: Score from 0.0 to 1.0

Text to analyze:
"""
${content}
"""

Requirements:
1. Only identify clear, objective manipulation patterns
2. Provide descriptions in ${language}
3. Include enough context in original_text for accurate matching
4. Return valid JSON only, no additional text

Response format:
{
  "manipulations": [
    {
      "original_text": "exact text from content",
      "manipulation_type": "fear_mongering",
      "manipulation_description": "explanation in ${language}",
      "confidence": 0.85
    }
  ]
}
`;
  }

  private async callAPI(prompt: string): Promise<any> {
    switch (this.provider) {
      case 'gemini':
        return this.callGeminiAPI(prompt);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  private async callGeminiAPI(prompt: string): Promise<any> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
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
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private parseResponse(response: any): ManipulationAnalysis {
    try {
      // Extract text from Gemini response format
      const text = response.candidates[0].content.parts[0].text;
      
      // Parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        manipulations: parsed.manipulations.map(this.validateManipulationBlock),
        analysisDate: new Date().toISOString(),
        provider: this.provider,
        model: this.model
      };
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  private validateManipulationBlock(block: any): ManipulationBlock {
    const required = ['original_text', 'manipulation_type', 'manipulation_description'];
    
    for (const field of required) {
      if (!block[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!MANIPULATION_TYPES.includes(block.manipulation_type)) {
      throw new Error(`Invalid manipulation type: ${block.manipulation_type}`);
    }

    return {
      original_text: block.original_text,
      manipulation_type: block.manipulation_type as ManipulationType,
      manipulation_description: block.manipulation_description,
      confidence: block.confidence || 0.5
    };
  }
}

class AnalysisError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'AnalysisError';
  }
}
```

### 5. Storage & Security

```typescript
// shared/storage.ts
export class SecureStorage {
  private static readonly ENCRYPTION_KEY = 'manipulation-detector-key';
  
  static async storeAPIKey(provider: string, apiKey: string): Promise<void> {
    const encrypted = this.obfuscate(apiKey);
    await chrome.storage.sync.set({
      [`apiKey_${provider}`]: encrypted
    });
  }

  static async getAPIKey(provider: string): Promise<string | null> {
    const result = await chrome.storage.sync.get(`apiKey_${provider}`);
    const encrypted = result[`apiKey_${provider}`];
    
    return encrypted ? this.deobfuscate(encrypted) : null;
  }

  static async storeSettings(settings: UserSettings): Promise<void> {
    await chrome.storage.sync.set({
      userSettings: settings
    });
  }

  static async getSettings(): Promise<UserSettings> {
    const result = await chrome.storage.sync.get('userSettings');
    return result.userSettings || DEFAULT_SETTINGS;
  }

  private static obfuscate(text: string): string {
    // Basic obfuscation - NOT secure encryption
    // For MVP only, warns users about security
    return btoa(text.split('').reverse().join(''));
  }

  private static deobfuscate(obfuscated: string): string {
    return atob(obfuscated).split('').reverse().join('');
  }

  static async testConnection(provider: string, model: string): Promise<boolean> {
    const apiKey = await this.getAPIKey(provider);
    if (!apiKey) return false;

    try {
      const client = new LLMClient({ provider, model, apiKey });
      await client.analyzeText('Test text for connection.', 'en');
      return true;
    } catch {
      return false;
    }
  }
}

const DEFAULT_SETTINGS: UserSettings = {
  provider: 'gemini',
  model: 'gemini-pro',
  language: 'en',
  highlightMode: 'full-color',
  autoAnalyze: false
};
```

## Message Passing Architecture

```typescript
// shared/messaging.ts
export enum MessageType {
  ANALYZE_PAGE = 'ANALYZE_PAGE',
  ANALYZE_SELECTION = 'ANALYZE_SELECTION',
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  ANALYSIS_ERROR = 'ANALYSIS_ERROR',
  GET_ANALYSIS_STATUS = 'GET_ANALYSIS_STATUS',
  CLEAR_HIGHLIGHTS = 'CLEAR_HIGHLIGHTS'
}

export interface Message {
  type: MessageType;
  payload?: any;
  tabId?: number;
  timestamp: number;
}

// Background service worker message handling
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const analysisManager = AnalysisManager.getInstance();
  
  switch (message.type) {
    case MessageType.ANALYZE_PAGE:
      analysisManager.analyzePage(sender.tab!.id!, message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response
      
    case MessageType.ANALYZE_SELECTION:
      analysisManager.analyzeSelection(sender.tab!.id!, message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case MessageType.GET_ANALYSIS_STATUS:
      const status = analysisManager.getAnalysisStatus(sender.tab!.id!);
      sendResponse({ success: true, data: status });
      break;
  }
});
```

## Performance Optimizations

### 1. Content Extraction Caching
```typescript
class ContentCache {
  private static cache = new Map<string, CachedContent>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static get(url: string): ExtractedContent | null {
    const cached = this.cache.get(url);
    if (!cached || Date.now() - cached.timestamp > this.CACHE_DURATION) {
      return null;
    }
    return cached.content;
  }

  static set(url: string, content: ExtractedContent): void {
    this.cache.set(url, {
      content,
      timestamp: Date.now()
    });
  }
}
```

### 2. Lazy Loading & Code Splitting
```typescript
// Dynamic imports for heavy components
const ContentExtractor = lazy(() => import('./content-extractor'));
const TextHighlighter = lazy(() => import('./text-highlighter'));
```

### 3. Debounced Text Selection
```typescript
class SelectionHandler {
  private debounceTimer: number | null = null;
  
  handleSelectionChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 10) {
        this.notifySelectionReady(selection.toString());
      }
    }, 500);
  }
}
```

## Error Handling Strategy

### 1. Graceful Degradation
```typescript
class RobustAnalyzer {
  async analyzeWithFallback(content: string): Promise<ManipulationAnalysis> {
    try {
      return await this.primaryAnalysis(content);
    } catch (error) {
      console.warn('Primary analysis failed:', error);
      return this.fallbackAnalysis(content);
    }
  }
  
  private fallbackAnalysis(content: string): ManipulationAnalysis {
    // Basic pattern matching for common manipulation indicators
    return {
      manipulations: this.detectBasicPatterns(content),
      analysisDate: new Date().toISOString(),
      provider: 'fallback',
      model: 'pattern-matching'
    };
  }
}
```

### 2. User-Friendly Error Messages
```typescript
export const ERROR_MESSAGES = {
  API_KEY_MISSING: 'Please add your API key in the settings.',
  API_KEY_INVALID: 'API key appears to be invalid. Please check your settings.',
  NETWORK_ERROR: 'Unable to connect to the analysis service. Please check your internet connection.',
  CONTENT_EXTRACTION_FAILED: 'Could not extract content from this page. Try selecting specific text instead.',
  RATE_LIMIT_EXCEEDED: 'API rate limit exceeded. Please wait a moment before trying again.',
  UNSUPPORTED_SITE: 'This website type is not fully supported. Try selecting specific text to analyze.'
};
```

## Testing Strategy

### 1. Unit Tests
- Content extraction accuracy
- Text matching precision
- LLM response parsing
- Storage encryption/decryption

### 2. Integration Tests
- End-to-end analysis workflow
- Cross-browser compatibility
- API integration reliability

### 3. Website Compatibility Tests
```typescript
const TEST_SITES = [
  'https://www.bbc.com/news',      // Major news site
  'https://www.cnn.com',          // Major news site
  'https://medium.com',           // Blog platform
  'https://www.reuters.com',      // News agency
  'https://techcrunch.com',       // Tech news
];
```

## Deployment & Distribution

### 1. Build Process
```json
{
  "scripts": {
    "build": "webpack --mode=production",
    "build:dev": "webpack --mode=development",
    "watch": "webpack --mode=development --watch",
    "test": "jest",
    "package": "web-ext build --source-dir=dist"
  }
}
```

### 2. Chrome Web Store Package
- Manifest V3 compliance
- Permission justifications
- Privacy policy
- Content security policy

This technical design provides a solid foundation for implementing the Chrome extension with robust content extraction, accurate text matching, and flexible LLM integration while maintaining good performance and user experience.