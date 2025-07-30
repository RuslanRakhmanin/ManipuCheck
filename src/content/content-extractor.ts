import { ExtractedContent } from '../shared/types';
import { normalizeText, countWords } from '../shared/utils';

export class ContentExtractor {
  private document: Document;
  
  constructor(document: Document = window.document) {
    this.document = document;
  }

  extractContent(): ExtractedContent | null {
    return this.extractMainContent();
  }

  extractMainContent(): ExtractedContent | null {
    // Try Readability-style extraction first
    const readabilityContent = this.readabilityExtraction();
    if (readabilityContent) {
      return readabilityContent;
    }

    // Fallback to selector-based extraction
    return this.fallbackExtraction();
  }

  private readabilityExtraction(): ExtractedContent | null {
    // Simplified Readability algorithm
    const candidates = this.findContentCandidates();
    const bestCandidate = this.selectBestCandidate(candidates);
    
    if (!bestCandidate) return null;

    const title = this.extractTitle();
    const content = this.extractTextContent(bestCandidate);
    const htmlContent = bestCandidate.innerHTML;

    if (countWords(content) < 100) return null;

    return {
      title,
      content,
      htmlContent,
      wordCount: countWords(content),
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
  }

  private findContentCandidates(): Array<{ element: Element; score: number }> {
    const candidates: Array<{ element: Element; score: number }> = [];
    
    // Look for common content containers
    const selectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#main-content',
      '.main-content',
      'main'
    ];

    selectors.forEach(selector => {
      const elements = this.document.querySelectorAll(selector);
      elements.forEach(element => {
        const score = this.scoreElement(element);
        if (score > 0) {
          candidates.push({ element, score });
        }
      });
    });

    // Also check divs with high text content
    const divs = this.document.querySelectorAll('div');
    divs.forEach(div => {
      const score = this.scoreElement(div);
      if (score > 50) { // Higher threshold for generic divs
        candidates.push({ element: div, score });
      }
    });

    return candidates.sort((a, b) => b.score - a.score);
  }

  private scoreElement(element: Element): number {
    let score = 0;
    const text = element.textContent || '';
    const wordCount = countWords(text);
    
    // Base score from word count
    score += Math.min(wordCount / 10, 50);
    
    // Bonus for semantic elements
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'article') score += 25;
    if (tagName === 'main') score += 20;
    if (element.getAttribute('role') === 'main') score += 20;
    
    // Bonus for content-related classes/IDs
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    const contentKeywords = ['content', 'article', 'post', 'story', 'text', 'body'];
    
    contentKeywords.forEach(keyword => {
      if (className.includes(keyword)) score += 15;
      if (id.includes(keyword)) score += 15;
    });
    
    // Penalty for navigation/sidebar elements
    const negativeKeywords = ['nav', 'sidebar', 'menu', 'footer', 'header', 'ad', 'comment'];
    negativeKeywords.forEach(keyword => {
      if (className.includes(keyword)) score -= 20;
      if (id.includes(keyword)) score -= 20;
    });
    
    // Penalty for too many links (likely navigation)
    const links = element.querySelectorAll('a');
    const linkDensity = links.length / Math.max(wordCount / 100, 1);
    if (linkDensity > 0.5) score -= 20;
    
    // Penalty for short content
    if (wordCount < 50) score -= 30;
    
    return Math.max(score, 0);
  }

  private selectBestCandidate(candidates: Array<{ element: Element; score: number }>): Element | null {
    if (candidates.length === 0) return null;
    
    const best = candidates[0];
    
    // Must have minimum score and word count
    if (best.score < 20) return null;
    
    const wordCount = countWords(best.element.textContent || '');
    if (wordCount < 100) return null;
    
    return best.element;
  }

  private fallbackExtraction(): ExtractedContent | null {
    // Try common selectors as last resort
    const fallbackSelectors = [
      'body',
      '#content',
      '.container',
      '.wrapper'
    ];

    for (const selector of fallbackSelectors) {
      const element = this.document.querySelector(selector);
      if (element) {
        const content = this.extractTextContent(element);
        if (countWords(content) > 200) {
          return {
            title: this.extractTitle(),
            content,
            htmlContent: element.innerHTML,
            wordCount: countWords(content),
            url: window.location.href,
            extractedAt: new Date().toISOString()
          };
        }
      }
    }

    return null;
  }

  private extractTitle(): string {
    // Try multiple title sources
    const titleSelectors = [
      'h1',
      'title',
      '[property="og:title"]',
      '.title',
      '.headline',
      '.post-title'
    ];

    for (const selector of titleSelectors) {
      const element = this.document.querySelector(selector);
      if (element) {
        const title = element.textContent?.trim() || 
                     element.getAttribute('content')?.trim();
        if (title && title.length > 0) {
          return title;
        }
      }
    }

    return this.document.title || 'Untitled';
  }

  private extractTextContent(element: Element): string {
    // Clone element to avoid modifying original
    const clone = element.cloneNode(true) as Element;
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer',
      '.advertisement', '.ad', '.sidebar', '.menu',
      '.comments', '.social-share', '.related-posts'
    ];
    
    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Extract and normalize text
    const text = clone.textContent || '';
    return normalizeText(text);
  }

  convertToMarkdown(htmlContent: string): string {
    // Create temporary element for processing
    const tempDiv = this.document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Remove unwanted elements
    const unwantedSelectors = ['script', 'style', 'iframe', '.ad', '.advertisement'];
    unwantedSelectors.forEach(selector => {
      tempDiv.querySelectorAll(selector).forEach(el => el.remove());
    });

    return this.htmlToMarkdown(tempDiv);
  }

  private htmlToMarkdown(element: Element): string {
    let markdown = '';
    
    element.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) markdown += text + ' ';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        
        switch (tagName) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            const level = parseInt(tagName[1]);
            markdown += `\n${'#'.repeat(level)} ${el.textContent?.trim()}\n\n`;
            break;
          case 'p':
            markdown += `${el.textContent?.trim()}\n\n`;
            break;
          case 'strong':
          case 'b':
            markdown += `**${el.textContent?.trim()}**`;
            break;
          case 'em':
          case 'i':
            markdown += `*${el.textContent?.trim()}*`;
            break;
          case 'br':
            markdown += '\n';
            break;
          case 'blockquote':
            const lines = (el.textContent?.trim() || '').split('\n');
            lines.forEach(line => {
              if (line.trim()) markdown += `> ${line.trim()}\n`;
            });
            markdown += '\n';
            break;
          default:
            markdown += this.htmlToMarkdown(el);
        }
      }
    });

    return markdown.trim();
  }
}