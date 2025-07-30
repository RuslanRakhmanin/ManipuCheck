import { normalizeText } from '../shared/utils';

export interface TextPositionMap {
  node: Text;
  startOffset: number;
  endOffset: number;
  normalizedText: string;
}

export interface NodeLocation {
  node: Text;
  offset: number;
}

export interface DOMRange {
  range: Range;
  originalText: string;
  normalizedText: string;
}

export class TextMatcher {
  private textNodes: Text[] = [];
  private textPositionMap: TextPositionMap[] = [];
  private fullNormalizedText: string = '';
  
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
          // Skip empty text nodes and script/style content
          if (!text || text.length === 0) return NodeFilter.FILTER_REJECT;
          
          const parent = node.parentElement;
          if (parent) {
            const tagName = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript'].includes(tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let globalOffset = 0;
    let node: Text | null;
    
    while (node = walker.nextNode() as Text) {
      const originalText = node.textContent || '';
      const normalizedText = normalizeText(originalText);
      
      if (normalizedText.length > 0) {
        this.textPositionMap.push({
          node,
          startOffset: globalOffset,
          endOffset: globalOffset + normalizedText.length,
          normalizedText
        });
        
        this.textNodes.push(node);
        globalOffset += normalizedText.length;
        
        // Add space between text nodes for proper word separation
        if (globalOffset > 0) globalOffset += 1;
      }
    }
    
    // Build full normalized text for searching
    this.fullNormalizedText = this.textPositionMap
      .map(item => item.normalizedText)
      .join(' ');
  }

  findTextRanges(targetText: string): DOMRange[] {
    const normalizedTarget = normalizeText(targetText);
    const ranges: DOMRange[] = [];

    if (normalizedTarget.length === 0) return ranges;

    // Search for the normalized text in our full text
    let searchStart = 0;
    let matchIndex: number;
    
    while ((matchIndex = this.fullNormalizedText.indexOf(normalizedTarget, searchStart)) !== -1) {
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

    try {
      const range = document.createRange();
      range.setStart(startLocation.node, startLocation.offset);
      range.setEnd(endLocation.node, endLocation.offset + 1);
      
      return {
        range,
        originalText: range.toString(),
        normalizedText: normalizeText(range.toString())
      };
    } catch (error) {
      console.warn('Failed to create DOM range:', error);
      return null;
    }
  }

  private findNodeAtPosition(position: number): NodeLocation | null {
    let currentPos = 0;
    
    for (const mapItem of this.textPositionMap) {
      const nodeLength = mapItem.normalizedText.length;
      
      if (position >= currentPos && position < currentPos + nodeLength) {
        const relativeOffset = position - currentPos;
        const originalOffset = this.denormalizeOffset(
          mapItem.node.textContent || '', 
          relativeOffset
        );
        
        return {
          node: mapItem.node,
          offset: Math.min(originalOffset, mapItem.node.textContent?.length || 0)
        };
      }
      
      currentPos += nodeLength + 1; // +1 for space between nodes
    }
    
    return null;
  }

  private denormalizeOffset(originalText: string, normalizedOffset: number): number {
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
    
    return Math.min(originalPos, originalText.length);
  }

  // Alternative fuzzy matching for cases where exact matching fails
  findFuzzyTextRanges(targetText: string, threshold: number = 0.8): DOMRange[] {
    const normalizedTarget = normalizeText(targetText);
    const ranges: DOMRange[] = [];
    
    if (normalizedTarget.length < 10) return ranges; // Too short for fuzzy matching
    
    const words = normalizedTarget.split(' ');
    if (words.length < 3) return ranges; // Need multiple words for fuzzy matching
    
    // Try to find ranges that contain most of the words
    const windowSize = Math.min(words.length * 2, 20); // Reasonable window size
    const fullTextWords = this.fullNormalizedText.split(' ');
    
    for (let i = 0; i <= fullTextWords.length - windowSize; i++) {
      const window = fullTextWords.slice(i, i + windowSize).join(' ');
      const similarity = this.calculateSimilarity(normalizedTarget, window);
      
      if (similarity >= threshold) {
        const windowStart = fullTextWords.slice(0, i).join(' ').length;
        const windowEnd = windowStart + window.length;
        
        const range = this.createDOMRange(windowStart, windowEnd);
        if (range) {
          ranges.push(range);
        }
      }
    }
    
    return ranges;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(' '));
    const words2 = new Set(text2.toLowerCase().split(' '));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // Get text content around a position for context
  getContextAroundPosition(position: number, contextLength: number = 100): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(this.fullNormalizedText.length, position + contextLength);
    
    return this.fullNormalizedText.substring(start, end);
  }
}