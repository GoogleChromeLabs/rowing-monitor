/**
 * Mock implementation of IndexedDB for testing Logbook.
 */

export class MockIDBObjectStore {
  constructor(name) {
    this.name = name;
    this.records = [];
  }

  add(value) {
    this.records.push(value);
    return {
      onsuccess: null,
      onerror: null
    };
  }

  openCursor() {
    const request = {
      onsuccess: null,
      onerror: null
    };

    queueMicrotask(() => {
      let index = 0;
      const iterate = () => {
        if (index < this.records.length) {
          const value = this.records[index];
          index++;
          const cursor = {
            value,
            continue: () => {
              queueMicrotask(iterate);
            }
          };
          if (request.onsuccess) {
            request.onsuccess({ target: { result: cursor } });
          }
        } else {
          if (request.onsuccess) {
            request.onsuccess({ target: { result: null } });
          }
        }
      };
      iterate();
    });

    return request;
  }
}

export class MockIDBTransaction {
  constructor(storeNames, mode, db) {
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    this.mode = mode;
    this.db = db;
    this.oncomplete = null;
    this.onerror = null;

    queueMicrotask(() => {
      if (this.oncomplete) {
        this.oncomplete();
      }
    });
  }

  objectStore(name) {
    return this.db.objectStores.get(name);
  }
}

export class MockIDBDatabase {
  constructor(name) {
    this.name = name;
    this.objectStores = new Map();
  }

  createObjectStore(name, options) {
    const store = new MockIDBObjectStore(name);
    this.objectStores.set(name, store);
    return store;
  }

  transaction(storeNames, mode = 'readonly') {
    return new MockIDBTransaction(storeNames, mode, this);
  }
}

export class MockIDBFactory {
  constructor() {
    this.databases = new Map();
  }

  open(name, version) {
    const request = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: null
    };

    queueMicrotask(() => {
      let db = this.databases.get(name);
      const isNew = !db;
      if (isNew) {
        db = new MockIDBDatabase(name);
        this.databases.set(name, db);
      }
      request.result = db;

      if (isNew && request.onupgradeneeded) {
        request.onupgradeneeded({ target: { result: db } });
      }

      if (request.onsuccess) {
        request.onsuccess({ target: { result: db } });
      }
    });

    return request;
  }
}
