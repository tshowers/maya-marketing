import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CacheService } from './cache.service';



@Injectable({
  providedIn: 'root'
})
export class SystemRecoveryService {


  private troubleKeywords = [
    "what's wrong",
    "why isn't this working",
    "why am i not getting a response",
    "you're paused",
    "you're not responding",
    "system is not working",
    "reload",
    "problem",
    "cache"
  ];

  constructor() { }

  isSystemTrouble(message: string): boolean {
    const lower = message.toLowerCase();
    return this.troubleKeywords.some(kw => lower.includes(kw));
  }

  getRecoveryActions(router: Router, cacheService: CacheService): { label: string; action: () => void }[] {
    return [
      { label: 'Reload Page', action: () => location.reload() },
      { label: 'Clear Cache', action: () => cacheService.clearAll() },
      { label: 'Visit Help Page', action: () => router.navigate(['/help']) }
    ];
  }
}
