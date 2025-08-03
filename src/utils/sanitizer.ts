// HTML sanitization utilities to prevent XSS attacks

export class HTMLSanitizer {
  // Allowed HTML tags for basic formatting
  private static readonly ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br'];
  
  // Allowed attributes
  private static readonly ALLOWED_ATTRS = ['class', 'id'];

  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  static sanitizeHTML(html: string): string {
    if (!html) return '';

    // Create a temporary DOM element
    const div = document.createElement('div');
    div.innerHTML = html;

    // Remove all script tags and event handlers
    this.removeScripts(div);
    this.removeEventHandlers(div);
    this.removeDisallowedTags(div);
    this.removeDisallowedAttributes(div);

    return div.innerHTML;
  }

  /**
   * Escape HTML characters to prevent injection
   */
  static escapeHTML(text: string): string {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create safe DOM element with sanitized content
   */
  static createSafeElement(tagName: string, content: string, attributes?: Record<string, string>): HTMLElement {
    const element = document.createElement(tagName);
    
    // Set safe text content
    element.textContent = content;
    
    // Add allowed attributes
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (this.ALLOWED_ATTRS.includes(key)) {
          element.setAttribute(key, this.escapeHTML(value));
        }
      });
    }

    return element;
  }

  private static removeScripts(element: Element): void {
    // Remove script tags
    const scripts = element.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove javascript: protocols
    const links = element.querySelectorAll('a[href^="javascript:"]');
    links.forEach(link => link.removeAttribute('href'));
  }

  private static removeEventHandlers(element: Element): void {
    // Remove all event handler attributes
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }

  private static removeDisallowedTags(element: Element): void {
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      if (!this.ALLOWED_TAGS.includes(el.tagName.toLowerCase())) {
        // Replace with span to preserve content
        const span = document.createElement('span');
        span.innerHTML = el.innerHTML;
        el.parentNode?.replaceChild(span, el);
      }
    });
  }

  private static removeDisallowedAttributes(element: Element): void {
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (!this.ALLOWED_ATTRS.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }
}

// Safe innerHTML replacement
export function setSafeInnerHTML(element: Element, html: string): void {
  element.innerHTML = HTMLSanitizer.sanitizeHTML(html);
}

// Safe text content with basic formatting support
export function setSafeContent(element: Element, content: string, allowBasicHTML = false): void {
  if (allowBasicHTML) {
    setSafeInnerHTML(element, content);
  } else {
    element.textContent = content;
  }
}