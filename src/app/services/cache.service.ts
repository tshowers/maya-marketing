import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';

export interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private isCacheEnabled: boolean = false;
  private cache: { [key: string]: { data: any[], timestamp: number } } = {};
  // private maxAgeMs = 60 * 60 * 1000; // 1 hour
  private maxAgeMs = 10 * 60 * 1000; // 10 minutes

  constructor(private logger: LoggerService) {
    this.evaluateSystemResources();
  }


  private evaluateSystemResources() {
    const nav = navigator as NavigatorWithDeviceMemory;
    const ram = nav.deviceMemory || 4;
    if (ram < 2) this.isCacheEnabled = false;

    // Or add load-time checks, worker lag, etc
  }

  getApproxRAM(): number {
    const nav = navigator as any;
    return nav.deviceMemory || 4; // fallback to 4GB if unknown
  }

  enable(): void {
    this.isCacheEnabled = true;
  }

  disable(): void {
    this.isCacheEnabled = false;
  }

  private buildCollectionKey(
    collectionName: string,
    tenantId?: string,
    filters?: string
  ): string {
    return `${collectionName}_${tenantId ?? 'public'}${filters ? `_${filters}` : ''}`;
  }

  checkCacheOrReturn<T>(
    collectionName: string,
    tenantId: string | undefined,
    loader: () => Observable<T[]>,
    filters?: string
  ): Observable<T[]> {
    const key = this.buildCollectionKey(collectionName, tenantId, filters);
    if (!this.isCacheEnabled) {
      this.logger.log(`[Cache DISABLED] Bypassing cache for: ${key}`);
      return loader();
    }
    const entry = this.cache[key];
    if (entry && (Date.now() - entry.timestamp) <= this.maxAgeMs) {
      this.logger.log(`[Cache HIT] Returning cached data for: ${key}`);
      return of(entry.data as T[]);
    }

    this.logger.log(`[Cache MISS] Fetching fresh data for: ${key}`);
    return loader().pipe(
      tap(data => {
        this.cache[key] = { data, timestamp: Date.now() };
        this.logger.log(`[Cache SET] Cache updated for: ${key}`);
      })
    );
  }

  checkCacheOrReturnPromise<T>(
    collectionName: string,
    tenantId: string | undefined,
    loader: () => Promise<T[]>,
    filters?: string
  ): Promise<T[]> {
    const key = this.buildCollectionKey(collectionName, tenantId, filters);
    if (!this.isCacheEnabled) {
      this.logger.info(`[Cache DISABLED] Bypassing cache for: ${key}`);
      return loader();
    }
    const entry = this.cache[key];
    if (entry && (Date.now() - entry.timestamp) <= this.maxAgeMs) {
      this.logger.info(`[Cache HIT] Returning cached data for: ${key}`);
      return Promise.resolve(entry.data as T[]);
    }

    this.logger.info(`[Cache MISS] Fetching fresh data for: ${key}`);
    return loader().then(data => {
      this.cache[key] = { data, timestamp: Date.now() };
      this.logger.info(`[Cache SET] Cache updated for: ${key}`);
      return data;
    });
  }

  removeItem<T>(
    collectionName: string,
    tenantId: string | undefined,
    matchFn: (item: T) => boolean,
    filters?: string
  ): void {
    if (!this.isCacheEnabled) return;
    const key = this.buildCollectionKey(collectionName, tenantId, filters);
    const entry = this.cache[key];
    if (entry) {
      const originalLength = entry.data.length;
      entry.data = entry.data.filter((item: T) => !matchFn(item));
      this.logger.info(`[Cache UPDATE] Removed ${originalLength - entry.data.length} item(s) from cache: ${key}`);
    }
  }

  clear(key: string): void {
    if (!this.isCacheEnabled) return;
    delete this.cache[key];
  }

  clearAll(): void {
    if (!this.isCacheEnabled) return;
    this.cache = {};
    this.clearLocalStorage();
  }

  getCachedCollection<T>(collection: string, tenantId = 'public'): T[] {
    const key = `${collection}_${tenantId}`;
    return this.cache[key]?.data ?? [];
  }

  private clearLocalStorage(): void {
    localStorage.clear();
  }

  toggleCache(enabled: boolean) {
    this.isCacheEnabled = enabled;
  }

}
