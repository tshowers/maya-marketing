import { Injectable } from '@angular/core';

/**
 * Lets the header (in the app shell) offer "New chat" while a conversation
 * is open on the home page. The chat registers itself while it is on screen.
 */
@Injectable( { providedIn: 'root' } )
export class MayaChatStateService {
  private chat: { hasConversation: () => boolean; newChat: () => void } | null = null;

  register ( chat: { hasConversation: () => boolean; newChat: () => void } ): void {
    this.chat = chat;
  }

  unregister (): void {
    this.chat = null;
  }

  get hasConversation (): boolean {
    return !!this.chat?.hasConversation();
  }

  newChat (): void {
    this.chat?.newChat();
  }
}
