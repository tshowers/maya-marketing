import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationComponent } from '../shared/page/notification/notification.component';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

type NotifyType = 'success' | 'error' | 'warning' | 'info';
interface PendingNotification {
  header: string;
  description: string;
  type: NotifyType;
  createdAt: number;
}

@Injectable( {
  providedIn: 'root'
} )
export class NotificationService {
  private readonly logger = inject( LoggerService );

  private newMessageSubject = new BehaviorSubject<boolean>( false );
  private notifier?: NotificationComponent;
  private pending: PendingNotification[] = [];
  newMessage$ = this.newMessageSubject.asObservable();

  private log ( ...args: any[] ): void {
    // Keep this lightweight; you can swap to LoggerService later if you want.
    // eslint-disable-next-line no-console
    if ( !environment.production )
      this.logger.log( '[NotificationService]', ...args );
  }

  register ( notifier: NotificationComponent ): void {
    this.notifier = notifier;
    this.log( 'register() called. notifier set?', !!this.notifier, 'pending count:', this.pending.length );

    // Flush anything queued before the component finished rendering/bootstrapping.
    if ( this.notifier && this.pending.length ) {
      const toFlush = [...this.pending];
      this.pending = [];
      for ( const n of toFlush ) {
        this.log( 'flushing pending notification:', n.header, n.type );
        this.notifier.display( n.header, n.description, n.type );
      }
    }
  }

  notifyNewMessage () {
    this.log( 'notifyNewMessage()' );
    this.newMessageSubject.next( true );
  }

  clearNotification () {
    this.log( 'clearNotification()' );
    this.newMessageSubject.next( false );
  }

  show (
    header: string,
    description: string,
    type: NotifyType = 'info'
  ): void {
    this.log( 'show()', { header, type, hasNotifier: !!this.notifier } );

    // Also emit the "new message" signal for any listeners
    this.newMessageSubject.next( true );

    if ( this.notifier ) {
      this.notifier.display( header, description, type );
      return;
    }

    // If the notifier component hasn't registered yet, queue it so it can display later.
    this.pending.push( { header, description, type, createdAt: Date.now() } );

    // Keep the queue small to avoid runaway memory usage.
    if ( this.pending.length > 10 ) this.pending.shift();

    // eslint-disable-next-line no-console
    if ( !environment.production )
      this.logger.warn( '[NotificationService] notifier not registered yet; queued notification:', header );
  }

  hide (): void {
    this.log( 'hide()', { hasNotifier: !!this.notifier } );
    this.notifier?.dismiss();
  }
}
