import { Injectable } from '@angular/core';

interface MayaChat {
  hasConversation: () => boolean;
  newChat: () => void;
  /** Signed in, so past conversations are saved and can be listed. */
  hasHistory: () => boolean;
  openHistory: () => void;
}

/**
 * Lets the header (in the app shell) offer "New chat" and "History" while
 * the chat is on the home page. The chat registers itself while it is on screen.
 */
@Injectable( { providedIn: 'root' } )
export class MayaChatStateService {
  private chat: MayaChat | null = null;

  register ( chat: MayaChat ): void {
    this.chat = chat;
  }

  unregister (): void {
    this.chat = null;
  }

  get hasConversation (): boolean {
    return !!this.chat?.hasConversation();
  }

  get hasHistory (): boolean {
    return !!this.chat?.hasHistory();
  }

  newChat (): void {
    this.chat?.newChat();
  }

  openHistory (): void {
    this.chat?.openHistory();
  }
}
