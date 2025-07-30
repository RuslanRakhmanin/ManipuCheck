import { ManipulationBlock, ManipulationType } from '../shared/types';
import { MANIPULATION_COLORS, MANIPULATION_CATEGORIES } from '../shared/constants';

export interface TooltipPosition {
  x: number;
  y: number;
}

export class TooltipManager {
  private static readonly TOOLTIP_ID = 'manipulation-detector-tooltip';
  private static readonly TOOLTIP_STYLES_ID = 'manipulation-detector-tooltip-styles';
  
  private tooltip: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private hideTimeout: number | null = null;
  private isVisible: boolean = false;

  constructor() {
    this.injectTooltipStyles();
    this.setupEventListeners();
  }

  showTooltip(targetElement: HTMLElement, manipulation: ManipulationBlock): void {
    // Clear any pending hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.currentTarget = targetElement;
    
    if (!this.tooltip) {
      this.createTooltip();
    }

    if (this.tooltip) {
      this.updateTooltipContent(manipulation);
      this.positionTooltip(targetElement);
      this.showTooltipElement();
    }
  }

  hideTooltip(delay: number = 300): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this.hideTimeout = window.setTimeout(() => {
      this.hideTooltipElement();
      this.currentTarget = null;
    }, delay);
  }

  toggleTooltip(targetElement: HTMLElement, manipulation: ManipulationBlock): void {
    if (this.isVisible && this.currentTarget === targetElement) {
      this.hideTooltip(0);
    } else {
      this.showTooltip(targetElement, manipulation);
    }
  }

  private createTooltip(): void {
    this.tooltip = document.createElement('div');
    this.tooltip.id = TooltipManager.TOOLTIP_ID;
    this.tooltip.className = 'manipulation-tooltip';
    
    // Add event listeners to prevent hiding when hovering over tooltip
    this.tooltip.addEventListener('mouseenter', () => {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    });

    this.tooltip.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    document.body.appendChild(this.tooltip);
  }

  private updateTooltipContent(manipulation: ManipulationBlock): void {
    if (!this.tooltip) return;

    const category = this.getManipulationCategory(manipulation.manipulation_type);
    const color = MANIPULATION_COLORS[manipulation.manipulation_type];
    const confidencePercentage = Math.round(manipulation.confidence * 100);

    this.tooltip.innerHTML = `
      <div class="tooltip-header" style="border-left-color: ${color}">
        <div class="tooltip-type">${this.formatManipulationType(manipulation.manipulation_type)}</div>
        <div class="tooltip-category">${category}</div>
      </div>
      
      <div class="tooltip-content">
        <div class="tooltip-description">
          ${manipulation.manipulation_description}
        </div>
        
        <div class="tooltip-confidence">
          <div class="confidence-label">Confidence:</div>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${confidencePercentage}%; background-color: ${color}"></div>
          </div>
          <div class="confidence-value">${confidencePercentage}%</div>
        </div>
        
        <div class="tooltip-original-text">
          <div class="original-text-label">Detected text:</div>
          <div class="original-text-content">"${this.truncateText(manipulation.original_text, 150)}"</div>
        </div>
      </div>
      
      <div class="tooltip-footer">
        <div class="tooltip-tip">Click to pin/unpin this tooltip</div>
      </div>
    `;
  }

  private positionTooltip(targetElement: HTMLElement): void {
    if (!this.tooltip) return;

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    let position = this.calculateOptimalPosition(
      targetRect,
      tooltipRect,
      viewportWidth,
      viewportHeight
    );

    // Adjust for scroll position
    position.x += scrollX;
    position.y += scrollY;

    // Ensure tooltip stays within viewport bounds
    position = this.constrainToViewport(position, tooltipRect, viewportWidth, viewportHeight, scrollX, scrollY);

    this.tooltip.style.left = `${position.x}px`;
    this.tooltip.style.top = `${position.y}px`;
  }

  private calculateOptimalPosition(
    targetRect: DOMRect,
    tooltipRect: DOMRect,
    viewportWidth: number,
    viewportHeight: number
  ): TooltipPosition {
    const margin = 10;
    
    // Try positioning above the target first
    let x = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    let y = targetRect.top - tooltipRect.height - margin;

    // If tooltip would go above viewport, position below
    if (y < 0) {
      y = targetRect.bottom + margin;
    }

    // If tooltip would go below viewport, try above again with different positioning
    if (y + tooltipRect.height > viewportHeight) {
      y = targetRect.top - tooltipRect.height - margin;
      
      // If still doesn't fit, position at the side
      if (y < 0) {
        y = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        
        // Try right side first
        x = targetRect.right + margin;
        
        // If doesn't fit on right, try left
        if (x + tooltipRect.width > viewportWidth) {
          x = targetRect.left - tooltipRect.width - margin;
        }
      }
    }

    return { x, y };
  }

  private constrainToViewport(
    position: TooltipPosition,
    tooltipRect: DOMRect,
    viewportWidth: number,
    viewportHeight: number,
    scrollX: number,
    scrollY: number
  ): TooltipPosition {
    const margin = 5;

    // Constrain horizontally
    if (position.x < scrollX + margin) {
      position.x = scrollX + margin;
    } else if (position.x + tooltipRect.width > scrollX + viewportWidth - margin) {
      position.x = scrollX + viewportWidth - tooltipRect.width - margin;
    }

    // Constrain vertically
    if (position.y < scrollY + margin) {
      position.y = scrollY + margin;
    } else if (position.y + tooltipRect.height > scrollY + viewportHeight - margin) {
      position.y = scrollY + viewportHeight - tooltipRect.height - margin;
    }

    return position;
  }

  private showTooltipElement(): void {
    if (!this.tooltip) return;

    this.tooltip.style.display = 'block';
    this.tooltip.style.opacity = '0';
    this.tooltip.style.transform = 'translateY(10px)';

    // Force reflow
    this.tooltip.offsetHeight;

    this.tooltip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    this.tooltip.style.opacity = '1';
    this.tooltip.style.transform = 'translateY(0)';
    
    this.isVisible = true;
  }

  private hideTooltipElement(): void {
    if (!this.tooltip) return;

    this.tooltip.style.opacity = '0';
    this.tooltip.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      if (this.tooltip) {
        this.tooltip.style.display = 'none';
      }
      this.isVisible = false;
    }, 200);
  }

  private getManipulationCategory(type: ManipulationType): string {
    for (const [category, types] of Object.entries(MANIPULATION_CATEGORIES)) {
      if (types.includes(type)) {
        return category;
      }
    }
    return 'Unknown';
  }

  private formatManipulationType(type: ManipulationType): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private setupEventListeners(): void {
    // Handle clicks outside tooltip to hide it
    document.addEventListener('click', (event) => {
      if (this.isVisible && this.tooltip && this.currentTarget) {
        const target = event.target as Element;
        
        // Don't hide if clicking on the tooltip or the highlighted element
        if (!this.tooltip.contains(target) && !this.currentTarget.contains(target)) {
          this.hideTooltip(0);
        }
      }
    });

    // Handle escape key to hide tooltip
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible) {
        this.hideTooltip(0);
      }
    });

    // Handle scroll to reposition tooltip
    document.addEventListener('scroll', () => {
      if (this.isVisible && this.currentTarget && this.tooltip) {
        this.positionTooltip(this.currentTarget);
      }
    }, { passive: true });

    // Handle window resize to reposition tooltip
    window.addEventListener('resize', () => {
      if (this.isVisible && this.currentTarget && this.tooltip) {
        this.positionTooltip(this.currentTarget);
      }
    });
  }

  private injectTooltipStyles(): void {
    if (document.getElementById(TooltipManager.TOOLTIP_STYLES_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = TooltipManager.TOOLTIP_STYLES_ID;
    style.textContent = this.generateTooltipCSS();
    
    document.head.appendChild(style);
  }

  private generateTooltipCSS(): string {
    return `
      .manipulation-tooltip {
        position: absolute;
        z-index: 10000;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        max-width: 320px;
        min-width: 250px;
        display: none;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      .tooltip-header {
        padding: 12px 16px 8px;
        border-left: 4px solid #007acc;
        background: #f8f9fa;
        border-radius: 8px 8px 0 0;
      }

      .tooltip-type {
        font-weight: 600;
        color: #333;
        margin-bottom: 2px;
      }

      .tooltip-category {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .tooltip-content {
        padding: 12px 16px;
      }

      .tooltip-description {
        color: #444;
        margin-bottom: 12px;
        line-height: 1.5;
      }

      .tooltip-confidence {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .confidence-label {
        font-size: 12px;
        color: #666;
        font-weight: 500;
      }

      .confidence-bar {
        flex: 1;
        height: 6px;
        background: #e0e0e0;
        border-radius: 3px;
        overflow: hidden;
      }

      .confidence-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .confidence-value {
        font-size: 12px;
        color: #333;
        font-weight: 600;
        min-width: 35px;
        text-align: right;
      }

      .tooltip-original-text {
        border-top: 1px solid #e0e0e0;
        padding-top: 12px;
      }

      .original-text-label {
        font-size: 12px;
        color: #666;
        font-weight: 500;
        margin-bottom: 4px;
      }

      .original-text-content {
        font-style: italic;
        color: #555;
        background: #f5f5f5;
        padding: 8px;
        border-radius: 4px;
        border-left: 3px solid #ddd;
      }

      .tooltip-footer {
        padding: 8px 16px 12px;
        border-top: 1px solid #f0f0f0;
      }

      .tooltip-tip {
        font-size: 11px;
        color: #888;
        text-align: center;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .manipulation-tooltip {
          background: #2d2d2d;
          border-color: #444;
          color: #e0e0e0;
        }

        .tooltip-header {
          background: #3a3a3a;
        }

        .tooltip-type {
          color: #e0e0e0;
        }

        .tooltip-category {
          color: #aaa;
        }

        .tooltip-description {
          color: #ccc;
        }

        .confidence-label {
          color: #aaa;
        }

        .confidence-bar {
          background: #444;
        }

        .confidence-value {
          color: #e0e0e0;
        }

        .original-text-label {
          color: #aaa;
        }

        .original-text-content {
          color: #ccc;
          background: #3a3a3a;
          border-left-color: #555;
        }

        .tooltip-footer {
          border-top-color: #444;
        }

        .tooltip-tip {
          color: #888;
        }
      }

      /* Animation for tooltip appearance */
      @keyframes tooltipFadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Responsive design for smaller screens */
      @media (max-width: 480px) {
        .manipulation-tooltip {
          max-width: calc(100vw - 20px);
          min-width: 200px;
        }
      }
    `;
  }

  // Cleanup method for when extension is disabled
  destroy(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    const styleElement = document.getElementById(TooltipManager.TOOLTIP_STYLES_ID);
    if (styleElement) {
      styleElement.remove();
    }

    this.currentTarget = null;
    this.isVisible = false;
  }
}