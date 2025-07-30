import { ManipulationBlock, HighlightMode, ManipulationType } from '../shared/types';
import { MANIPULATION_COLORS } from '../shared/constants';
import { TextMatcher } from './text-matcher';
import { TooltipManager } from './tooltip-manager';

export interface HighlightInfo {
  element: HTMLElement;
  manipulation: ManipulationBlock;
  range: Range;
  id: string;
}

export class TextHighlighter {
  private static readonly HIGHLIGHT_CLASS_PREFIX = 'manipulation-highlight';
  private static readonly STYLES_ID = 'manipulation-detector-styles';
  
  private highlightedElements: Map<string, HighlightInfo> = new Map();
  private tooltipManager: TooltipManager;
  private currentMode: HighlightMode = 'full-color';

  constructor() {
    this.tooltipManager = new TooltipManager();
    this.injectStyles();
  }

  highlightManipulations(manipulations: ManipulationBlock[], mode: HighlightMode): void {
    this.currentMode = mode;
    this.clearHighlights();
    
    manipulations.forEach((manipulation, index) => {
      this.highlightManipulation(manipulation, index);
    });
  }

  private highlightManipulation(manipulation: ManipulationBlock, index: number): void {
    const textMatcher = new TextMatcher(document.body);
    let ranges = textMatcher.findTextRanges(manipulation.original_text);
    
    // If exact matching fails, try fuzzy matching
    if (ranges.length === 0) {
      ranges = textMatcher.findFuzzyTextRanges(manipulation.original_text, 0.7);
    }
    
    ranges.forEach((domRange, rangeIndex) => {
      const highlightId = `highlight-${index}-${rangeIndex}-${Date.now()}`;
      const highlightElement = this.createHighlightElement(
        domRange.range, 
        manipulation, 
        highlightId
      );
      
      if (highlightElement) {
        this.highlightedElements.set(highlightId, {
          element: highlightElement,
          manipulation,
          range: domRange.range,
          id: highlightId
        });
      }
    });
  }

  private createHighlightElement(
    range: Range, 
    manipulation: ManipulationBlock, 
    highlightId: string
  ): HTMLElement | null {
    try {
      // Check if range is valid and not already highlighted
      if (range.collapsed || this.isRangeHighlighted(range)) {
        return null;
      }

      const span = document.createElement('span');
      span.id = highlightId;
      span.className = this.getHighlightClass(manipulation.manipulation_type);
      span.setAttribute('data-manipulation-type', manipulation.manipulation_type);
      span.setAttribute('data-manipulation-description', manipulation.manipulation_description);
      span.setAttribute('data-confidence', manipulation.confidence.toString());
      
      // Event listeners for tooltip
      span.addEventListener('mouseenter', (e) => {
        this.tooltipManager.showTooltip(e.target as HTMLElement, manipulation);
      });
      
      span.addEventListener('mouseleave', () => {
        this.tooltipManager.hideTooltip();
      });

      span.addEventListener('click', (e) => {
        e.preventDefault();
        this.tooltipManager.toggleTooltip(e.target as HTMLElement, manipulation);
      });
      
      // Wrap the range content
      range.surroundContents(span);
      
      return span;
    } catch (error) {
      console.warn('Failed to highlight text range:', error);
      
      // Try alternative highlighting method
      return this.createHighlightElementAlternative(range, manipulation, highlightId);
    }
  }

  private createHighlightElementAlternative(
    range: Range, 
    manipulation: ManipulationBlock, 
    highlightId: string
  ): HTMLElement | null {
    try {
      const contents = range.extractContents();
      const span = document.createElement('span');
      
      span.id = highlightId;
      span.className = this.getHighlightClass(manipulation.manipulation_type);
      span.setAttribute('data-manipulation-type', manipulation.manipulation_type);
      span.setAttribute('data-manipulation-description', manipulation.manipulation_description);
      span.setAttribute('data-confidence', manipulation.confidence.toString());
      
      span.appendChild(contents);
      range.insertNode(span);
      
      // Add event listeners
      span.addEventListener('mouseenter', (e) => {
        this.tooltipManager.showTooltip(e.target as HTMLElement, manipulation);
      });
      
      span.addEventListener('mouseleave', () => {
        this.tooltipManager.hideTooltip();
      });
      
      return span;
    } catch (error) {
      console.warn('Alternative highlighting also failed:', error);
      return null;
    }
  }

  private isRangeHighlighted(range: Range): boolean {
    const container = range.commonAncestorContainer;
    
    if (container.nodeType === Node.ELEMENT_NODE) {
      const element = container as Element;
      return element.querySelector(`[class*="${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}"]`) !== null;
    }
    
    if (container.parentElement) {
      return container.parentElement.closest(`[class*="${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}"]`) !== null;
    }
    
    return false;
  }

  private getHighlightClass(manipulationType: ManipulationType): string {
    const baseClass = `${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-${manipulationType}`;
    const modeClass = this.currentMode === 'low-contrast' ? 'low-contrast' : 'full-color';
    return `${baseClass} ${modeClass} manipulation-highlight-base`;
  }

  private injectStyles(): void {
    if (document.getElementById(TextHighlighter.STYLES_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = TextHighlighter.STYLES_ID;
    style.textContent = this.generateCSS();
    
    document.head.appendChild(style);
  }

  private generateCSS(): string {
    let css = `
      /* Base styles for all highlights */
      .manipulation-highlight-base {
        cursor: help;
        transition: all 0.2s ease;
        border-radius: 2px;
        position: relative;
        display: inline;
        line-height: inherit;
      }
      
      .manipulation-highlight-base:hover {
        filter: brightness(0.9);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
    `;

    // Generate styles for each manipulation type
    Object.entries(MANIPULATION_COLORS).forEach(([type, color]) => {
      css += `
        /* Full color mode for ${type} */
        .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-${type}.full-color {
          background-color: ${this.hexToRgba(color, 0.25)};
          border-bottom: 2px solid ${color};
          box-shadow: 0 1px 2px ${this.hexToRgba(color, 0.3)};
        }
        
        /* Low contrast mode for ${type} */
        .${TextHighlighter.HIGHLIGHT_CLASS_PREFIX}-${type}.low-contrast {
          background-color: rgba(128, 128, 128, 0.1);
          border-bottom: 1px dotted #888;
        }
      `;
    });

    return css;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  clearHighlights(): void {
    this.highlightedElements.forEach(highlight => {
      try {
        const parent = highlight.element.parentNode;
        if (parent) {
          // Move children out of highlight span
          while (highlight.element.firstChild) {
            parent.insertBefore(highlight.element.firstChild, highlight.element);
          }
          parent.removeChild(highlight.element);
          
          // Normalize text nodes to clean up
          if (parent.nodeType === Node.ELEMENT_NODE) {
            (parent as Element).normalize();
          }
        }
      } catch (error) {
        console.warn('Error removing highlight:', error);
      }
    });
    
    this.highlightedElements.clear();
    this.tooltipManager.hideTooltip();
  }

  updateHighlightMode(mode: HighlightMode): void {
    if (mode === this.currentMode) return;
    
    this.currentMode = mode;
    
    // Update existing highlights
    this.highlightedElements.forEach(highlight => {
      const newClass = this.getHighlightClass(highlight.manipulation.manipulation_type);
      highlight.element.className = newClass;
    });
  }

  getHighlightCount(): number {
    return this.highlightedElements.size;
  }

  getHighlightsByType(): Record<ManipulationType, number> {
    const counts: Record<string, number> = {};
    
    this.highlightedElements.forEach(highlight => {
      const type = highlight.manipulation.manipulation_type;
      counts[type] = (counts[type] || 0) + 1;
    });
    
    return counts as Record<ManipulationType, number>;
  }

  // Remove styles when extension is disabled/unloaded
  removeStyles(): void {
    const styleElement = document.getElementById(TextHighlighter.STYLES_ID);
    if (styleElement) {
      styleElement.remove();
    }
  }
}