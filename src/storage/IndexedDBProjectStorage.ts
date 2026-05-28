import { openDB, IDBPDatabase } from 'idb';
import { ProjectStorage } from './ProjectStorage';

const DB_NAME = 'xnovelist';
const STORE_NAME = 'files';

export class IndexedDBProjectStorage implements ProjectStorage {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }

  async readFile(path: string): Promise<string | null> {
    const db = await this.dbPromise;
    const value = await db.get(STORE_NAME, path);
    return value !== undefined ? value : null;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, content, path);
  }

  async deleteFile(path: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, path);
  }

  async listFiles(prefix?: string): Promise<string[]> {
    const db = await this.dbPromise;
    const keys = await db.getAllKeys(STORE_NAME) as string[];
    if (prefix) {
      return keys.filter((key) => key.startsWith(prefix));
    }
    return keys;
  }

  async exists(path: string): Promise<boolean> {
    const db = await this.dbPromise;
    const count = await db.count(STORE_NAME, path);
    return count > 0;
  }
}
