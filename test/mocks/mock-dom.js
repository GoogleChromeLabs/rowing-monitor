/**
 * Minimal DOM mock for testing App.js
 */

export class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName;
    this.attributes = {...attributes};
    this.classList = new Set();
    this.textContent = '';
    this.children = [];
    this.checked = false;
    this.listeners = new Map();
  }

  get className() {
    return Array.from(this.classList).join(' ');
  }

  set className(val) {
    this.classList.clear();
    if (val) {
      val.trim().split(/\s+/).forEach(c => this.classList.add(c));
    }
  }

  insertBefore(child, ref) {
    this.children.push(child);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
  }

  addEventListener(type, cb) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(cb);
  }

  removeEventListener(type, cb) {
    const list = this.listeners.get(type);
    if (list) list.delete(cb);
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type);
    if (list) {
      list.forEach(cb => cb(event));
    }
  }

  appendChild(child) {
    this.children.push(child);
  }

  querySelector(selector) {
    // simple selector matcher for our mock elements
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this._findDescendant(el => el.classList.has(cls));
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this._findDescendant(el => el.attributes.id === id);
    }
    return this._findDescendant(el => el.tagName.toLowerCase() === selector.toLowerCase());
  }

  _findDescendant(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const found = child._findDescendant(predicate);
      if (found) return found;
    }
    return null;
  }

  cloneNode(deep = true) {
    const clone = new MockElement(this.tagName, this.attributes);
    clone.textContent = this.textContent;
    this.classList.forEach(c => clone.classList.add(c));
    if (deep) {
      for (const child of this.children) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }
}

export function createMockDocument() {
  const elements = new Map();

  const switchEl = new MockElement('input', { id: 'myonoffswitch', type: 'checkbox' });
  const statusEl = new MockElement('span', { id: 'status' });
  const timeEl = new MockElement('span', { id: 'time' });
  const distanceEl = new MockElement('span', { id: 'distance' });
  const activePage = new MockElement('div', { class: 'page_active', 'data-page': 'monitor' });
  activePage.classList.add('page_active');
  const selectedTab = new MockElement('li', { class: 'navigation__item_selected', 'data-target-page': 'monitor' });
  selectedTab.classList.add('navigation__item_selected');
  const tabAnchor = new MockElement('a');
  selectedTab.appendChild(tabAnchor);

  const logbookTable = new MockElement('tbody', { class: 'logbook-records' });
  const noWorkout = new MockElement('div', { class: 'no-workout' });

  // Template for logbook-record
  const template = new MockElement('template', { id: 'logbook-record' });
  const templateContent = new MockElement('tr');
  const dateCell = new MockElement('td', { class: 'logentry__date' });
  dateCell.classList.add('logentry__date');
  const timeCell = new MockElement('td', { class: 'logentry__time' });
  timeCell.classList.add('logentry__time');
  const distCell = new MockElement('td', { class: 'logentry__distance' });
  distCell.classList.add('logentry__distance');
  templateContent.appendChild(dateCell);
  templateContent.appendChild(timeCell);
  templateContent.appendChild(distCell);
  template.content = templateContent;

  elements.set('#myonoffswitch', switchEl);
  elements.set('#status', statusEl);
  elements.set('#time', timeEl);
  elements.set('#distance', distanceEl);
  elements.set('.page_active', activePage);
  elements.set('.navigation__item_selected', selectedTab);
  elements.set('.logbook-records', logbookTable);
  elements.set('.no-workout', noWorkout);
  elements.set('#logbook-record', template);

  const pages = [activePage];
  const tabs = [selectedTab];

  const docEl = new MockElement('html');
  const headEl = new MockElement('head');
  const bodyEl = new MockElement('body');
  docEl.appendChild(headEl);
  docEl.appendChild(bodyEl);

  return {
    elements,
    switchEl,
    statusEl,
    timeEl,
    distanceEl,
    activePage,
    selectedTab,
    logbookTable,
    noWorkout,
    template,
    documentElement: docEl,
    head: headEl,
    body: bodyEl,
    createElement(tag) {
      return new MockElement(tag);
    },
    getElementsByTagName(tag) {
      if (tag.toLowerCase() === 'head') return [headEl];
      if (tag.toLowerCase() === 'body') return [bodyEl];
      if (tag.toLowerCase() === 'html') return [docEl];
      return [];
    },
    querySelector(sel) {
      return elements.get(sel) || null;
    },
    querySelectorAll(sel) {
      if (sel === '.navigation__item') return tabs;
      if (sel === '.page') return pages;
      return [];
    },
    importNode(externalNode, deep) {
      return externalNode.cloneNode(deep);
    }
  };
}
