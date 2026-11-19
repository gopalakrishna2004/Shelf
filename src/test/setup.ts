// Global test environment polyfills for Node/Vitest
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = createStorageMock();
}

if (typeof (globalThis as any).sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = createStorageMock();
}

if (typeof (globalThis as any).window === 'undefined') {
  const eventTarget = new EventTarget();
  try {
    const { setMaxListeners } = require('node:events');
    setMaxListeners(100, eventTarget);
  } catch {}
  const mockWindow = {
    dispatchEvent: (event: Event) => eventTarget.dispatchEvent(event),
    addEventListener: (type: string, callback: EventListenerOrEventListenerObject | null, options?: any) =>
      eventTarget.addEventListener(type, callback, options),
    removeEventListener: (type: string, callback: EventListenerOrEventListenerObject | null, options?: any) =>
      eventTarget.removeEventListener(type, callback, options),
    localStorage: (globalThis as any).localStorage,
    sessionStorage: (globalThis as any).sessionStorage,
    location: {
      hash: '',
      search: '',
      pathname: '/',
      origin: 'http://localhost:5174',
    },
    history: {
      replaceState: () => {},
      pushState: () => {},
    },
    scrollTo: () => {},
    setTimeout: (fn: any, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: any) => clearTimeout(id),
    setInterval: (fn: any, ms?: number) => setInterval(fn, ms),
    clearInterval: (id: any) => clearInterval(id),
    HTMLIFrameElement: class HTMLIFrameElement {},
  };
  (globalThis as any).window = mockWindow;
} else {
  if (!(globalThis as any).window.HTMLIFrameElement) {
    (globalThis as any).window.HTMLIFrameElement = class HTMLIFrameElement {};
  }
  if (typeof (globalThis as any).window.setTimeout === 'undefined') {
    (globalThis as any).window.setTimeout = setTimeout;
  }
  if (typeof (globalThis as any).window.clearTimeout === 'undefined') {
    (globalThis as any).window.clearTimeout = clearTimeout;
  }
  if (typeof (globalThis as any).window.setInterval === 'undefined') {
    (globalThis as any).window.setInterval = setInterval;
  }
  if (typeof (globalThis as any).window.clearInterval === 'undefined') {
    (globalThis as any).window.clearInterval = clearInterval;
  }
}

if (typeof (globalThis as any).HTMLIFrameElement === 'undefined') {
  (globalThis as any).HTMLIFrameElement = class HTMLIFrameElement {};
}

if (typeof (globalThis as any).MouseEvent === 'undefined') {
  (globalThis as any).MouseEvent = class MouseEvent extends Event {
    bubbles: boolean;
    cancelable: boolean;
    constructor(type: string, options?: any) {
      super(type, options);
      this.bubbles = options?.bubbles ?? false;
      this.cancelable = options?.cancelable ?? false;
    }
  };
}

if (typeof (globalThis as any).KeyboardEvent === 'undefined') {
  (globalThis as any).KeyboardEvent = class KeyboardEvent extends Event {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    bubbles: boolean;
    cancelable: boolean;
    constructor(type: string, options?: any) {
      super(type, options);
      this.key = options?.key ?? '';
      this.shiftKey = options?.shiftKey ?? false;
      this.ctrlKey = options?.ctrlKey ?? false;
      this.altKey = options?.altKey ?? false;
      this.metaKey = options?.metaKey ?? false;
      this.bubbles = options?.bubbles ?? false;
      this.cancelable = options?.cancelable ?? false;
    }
  };
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof (globalThis as any).document === 'undefined') {
  const docEventTarget = new EventTarget();
  try {
    const { setMaxListeners } = require('node:events');
    setMaxListeners(100, docEventTarget);
  } catch {}

  class MockNode {
    nodeType: number;
    nodeName: string;
    childNodes: MockNode[] = [];
    parentNode: MockNode | null = null;
    get ownerDocument(): any {
      return (globalThis as any).document;
    }
    _textContent: string = '';
    _listeners: Record<string, Function[]> = {};

    constructor(nodeType: number, nodeName: string) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
    }

    get textContent(): string {
      if (this.nodeType === 3) return this._textContent;
      return this.childNodes.map((c) => c.textContent).join('');
    }

    set textContent(val: string) {
      this.childNodes = [];
      if (this.nodeType === 3) {
        this._textContent = String(val);
      } else if (val) {
        const textNode = new MockNode(3, '#text');
        textNode._textContent = String(val);
        textNode.parentNode = this;
        this.childNodes.push(textNode);
      }
    }

    appendChild(child: MockNode) {
      if (child.parentNode) {
        child.parentNode.removeChild(child);
      }
      child.parentNode = this;
      this.childNodes.push(child);
      if (this.nodeName === 'SELECT' && (child as any).tagName === 'OPTION') {
        const el = this as any;
        el[el._options.length] = child;
        el._options.push(child);
      }
      return child;
    }

    removeChild(child: MockNode) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    insertBefore(newChild: MockNode, refChild: MockNode | null) {
      if (!refChild) return this.appendChild(newChild);
      const idx = this.childNodes.indexOf(refChild);
      if (idx === -1) return this.appendChild(newChild);
      if (newChild.parentNode) {
        newChild.parentNode.removeChild(newChild);
      }
      newChild.parentNode = this;
      this.childNodes.splice(idx, 0, newChild);
      return newChild;
    }

    addEventListener(type: string, callback: any) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(callback);
    }

    removeEventListener(type: string, callback: any) {
      if (!this._listeners[type]) return;
      this._listeners[type] = this._listeners[type].filter((cb) => cb !== callback);
    }

    dispatchEvent(event: any) {
      if (!event.target) {
        Object.defineProperty(event, 'target', { value: this, configurable: true });
      }
      Object.defineProperty(event, 'currentTarget', { value: this, configurable: true });

      let curr: MockNode | null = this;
      while (curr) {
        const listeners = curr._listeners[event.type] || [];
        for (const cb of [...listeners]) {
          try {
            cb.call(curr, event);
          } catch (e) {
            console.error(e);
          }
        }
        if (!event.bubbles) break;
        curr = curr.parentNode;
      }

      const doc = (globalThis as any).document;
      if (doc && doc._listeners && doc._listeners[event.type]) {
        for (const cb of [...doc._listeners[event.type]]) {
          try {
            cb.call(doc, event);
          } catch (e) {
            console.error(e);
          }
        }
      }
      return true;
    }

    click() {
      const ev = new (globalThis as any).MouseEvent('click', { bubbles: true, cancelable: true });
      this.dispatchEvent(ev);
    }

    focus() {
      if ((globalThis as any).document) {
        (globalThis as any).document.activeElement = this;
      }
      this.dispatchEvent(new Event('focus'));
    }

    blur() {
      if ((globalThis as any).document && (globalThis as any).document.activeElement === this) {
        (globalThis as any).document.activeElement = null;
      }
      this.dispatchEvent(new Event('blur'));
    }

    contains(other: any): boolean {
      let curr = other;
      while (curr) {
        if (curr === this) return true;
        curr = curr.parentNode;
      }
      return false;
    }
  }

  class MockElement extends MockNode {
    tagName: string;
    style: Record<string, string> = {};
    attributes: Record<string, string> = {};
    _options: MockElement[] = [];
    value: string = '';

    get type(): string {
      return this.attributes['type'] || (this.tagName === 'INPUT' ? 'text' : '');
    }
    set type(val: string) {
      this.attributes['type'] = val;
    }

    get name(): string {
      return this.attributes['name'] || '';
    }
    set name(val: string) {
      this.attributes['name'] = val;
    }

    get id(): string {
      return this.attributes['id'] || '';
    }
    set id(val: string) {
      this.attributes['id'] = val;
    }

    get disabled(): boolean {
      return this.attributes['disabled'] === 'true' || this.attributes['disabled'] === '';
    }
    set disabled(val: boolean) {
      if (val) this.attributes['disabled'] = 'true';
      else delete this.attributes['disabled'];
    }

    constructor(tag = 'div') {
      super(1, tag.toUpperCase());
      this.tagName = tag.toUpperCase();
    }

    get length(): number {
      return this._options.length;
    }

    get options(): MockElement[] {
      return this._options;
    }

    closest(selector: string): MockElement | null {
      let curr: MockNode | null = this;
      const cleanSelector = selector.replace(/[.[\]*="'-]/g, '').toUpperCase();
      while (curr) {
        if (curr instanceof MockElement) {
          if (selector === '*' || curr.tagName === cleanSelector || (curr.attributes['class'] && curr.attributes['class'].includes(selector.replace('.', '')))) {
            return curr;
          }
        }
        curr = curr.parentNode;
      }
      return null;
    }

    setAttribute(name: string, value: any) {
      this.attributes[name] = String(value);
    }

    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    }

    removeAttribute(name: string) {
      delete this.attributes[name];
    }

    querySelectorAll(selector: string): MockElement[] {
      const results: MockElement[] = [];
      const attrMatch = selector.match(/^([a-zA-Z0-9*]+)?\[([a-zA-Z0-9_-]+)(?:="?([^"\]]*)"?)?\]$/);
      const targetTag = attrMatch ? (attrMatch[1] ? attrMatch[1].toUpperCase() : null) : selector.toUpperCase();
      const attrName = attrMatch ? attrMatch[2] : null;
      const attrVal = attrMatch ? attrMatch[3] : null;

      const traverse = (node: MockNode) => {
        for (const child of node.childNodes) {
          if (child instanceof MockElement) {
            let matches = false;
            if (attrMatch) {
              const tagMatches = !targetTag || targetTag === '*' || child.tagName === targetTag;
              const val = child.attributes[attrName!] ?? (child as any)[attrName!];
              const attrMatches = attrVal !== undefined ? val === attrVal : val !== undefined;
              matches = tagMatches && attrMatches;
            } else if (selector === '*' || child.tagName === targetTag) {
              matches = true;
            }
            if (matches) {
              results.push(child);
            }
            traverse(child);
          }
        }
      };
      traverse(this);
      return results;
    }

    querySelector(selector: string): MockElement | null {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  if (typeof (globalThis as any).HTMLElement === 'undefined') {
    (globalThis as any).HTMLElement = MockElement;
  }
  if (typeof (globalThis as any).HTMLButtonElement === 'undefined') {
    (globalThis as any).HTMLButtonElement = MockElement;
  }
  if (typeof (globalThis as any).HTMLInputElement === 'undefined') {
    (globalThis as any).HTMLInputElement = MockElement;
  }

  const mockBody = new MockElement('body');
  const docListeners: Record<string, Function[]> = {};

  (globalThis as any).document = {
    title: 'Shelf',
    defaultView: (globalThis as any).window,
    nodeType: 9,
    nodeName: '#document',
    activeElement: null,
    body: mockBody,
    _listeners: docListeners,
    createElement: (tag: string) => new MockElement(tag),
    createElementNS: (_ns: string, tag: string) => new MockElement(tag),
    querySelector: (selector: string) => mockBody.querySelector(selector),
    querySelectorAll: (selector: string) => mockBody.querySelectorAll(selector),
    getElementById: (id: string) => {
      let found: any = null;
      const traverse = (node: any) => {
        if (!node) return;
        if (node.id === id || (node.getAttribute && node.getAttribute('id') === id)) {
          found = node;
          return;
        }
        for (const child of node.childNodes || []) {
          traverse(child);
          if (found) return;
        }
      };
      traverse(mockBody);
      return found;
    },
    createTextNode: (text: string) => {
      const node = new MockNode(3, '#text');
      node._textContent = String(text);
      return node;
    },
    dispatchEvent: (event: Event) => {
      const listeners = docListeners[event.type] || [];
      for (const cb of [...listeners]) {
        cb(event);
      }
      return true;
    },
    addEventListener: (type: string, callback: any) => {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(callback);
    },
    removeEventListener: (type: string, callback: any) => {
      if (!docListeners[type]) return;
      docListeners[type] = docListeners[type].filter((cb) => cb !== callback);
    },
  };
}
