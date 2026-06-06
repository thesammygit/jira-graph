/** Cached page-fetch results: trimmed issue payloads + when we last synced. */
export interface CachedBundle { issues: any[]; lastSync: string }

export interface IssueCache {
  get(key: string): Promise<CachedBundle | undefined>;
  set(key: string, value: CachedBundle): Promise<void>;
}

/** Test/SSR fallback. */
export class MemoryCache implements IssueCache {
  private map = new Map<string, CachedBundle>();
  async get(key: string) { return this.map.get(key); }
  async set(key: string, value: CachedBundle) { this.map.set(key, value); }
}

/**
 * IndexedDB-backed cache so reopening a several-thousand-ticket project is
 * instant — the next visit reads the cached payloads and fetches only the
 * `updated >=` delta. Hand-rolled promise wrappers; no dependency.
 */
export class IdbCache implements IssueCache {
  private dbP: Promise<IDBDatabase>;
  constructor(dbName = 'jira-graph-cache') {
    this.dbP = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('bundles');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async get(key: string): Promise<CachedBundle | undefined> {
    const db = await this.dbP;
    return new Promise((resolve, reject) => {
      const req = db.transaction('bundles', 'readonly').objectStore('bundles').get(key);
      req.onsuccess = () => resolve(req.result ?? undefined);
      req.onerror = () => reject(req.error);
    });
  }
  async set(key: string, value: CachedBundle): Promise<void> {
    const db = await this.dbP;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bundles', 'readwrite');
      tx.objectStore('bundles').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
