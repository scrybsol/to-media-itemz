interface CacheEntry<T> {
  data: T;
  timestamp: number;
  error: Error | null;
}

export class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      error: null,
    });

    setTimeout(() => this.cache.delete(key), ttl);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  setError(key: string, error: Error): void {
    this.cache.set(key, {
      data: null,
      timestamp: Date.now(),
      error,
    });
  }

  getSize(): number {
    return this.cache.size;
  }
}

export const createQueryCache = (ttl?: number) => new QueryCache(ttl);

export const globalQueryCache = new QueryCache();
