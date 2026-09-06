import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, Renderer2, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DropdownManagerComponent } from '../../../features/security/dropdown-manager/dropdown-manager.component';
import { DropdownEndpointKeys } from '../../../services/endpoints';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { Subscription } from 'rxjs';

@Component( {
  selector: 'app-drop-down-edit-button',
  standalone: true,
  imports: [CommonModule, DropdownManagerComponent],
  templateUrl: './drop-down-edit-button.component.html',
  styleUrl: './drop-down-edit-button.component.css'
} )
export class DropDownEditButtonComponent implements OnDestroy {
  // Which dropdown collection this button should edit, e.g. 'industries', 'taskStatus', etc.
  @Input() dropdownKey!: DropdownEndpointKeys;
  @Output() updated = new EventEmitter<void>();

  // Rendered wherever this button lives, which is sometimes inside a
  // backdrop-filter/transform ancestor. Those establish a containing block
  // for position:fixed descendants, so the overlay gets centered/sized against
  // that small ancestor instead of the viewport. Moving the overlay node to
  // <body> on open sidesteps that regardless of where this button is used.
  @ViewChild( 'overlayRef' ) overlayRef?: ElementRef<HTMLElement>;

  showModal = false;
  isAuthenticated = false;
  private authSubscription: Subscription;

  constructor (
    private renderer: Renderer2,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.authSubscription = this.authService.getUser().subscribe( user => {
      this.isAuthenticated = !!user;
    } );
  }

  openModal ( event?: MouseEvent ): void {
    if ( event ) {
      event.stopPropagation();
    }
    if ( !this.isAuthenticated ) {
      this.notificationService.show( 'Sign in required', 'You must be logged in to edit dropdown options.', 'info' );
      return;
    }
    if ( !this.dropdownKey ) {
      return;
    }
    this.showModal = true;
    setTimeout( () => {
      if ( this.overlayRef ) {
        this.renderer.appendChild( document.body, this.overlayRef.nativeElement );
      }
    } );
  }

  closeModal ( event?: MouseEvent ): void {
    if ( event ) {
      event.stopPropagation();
    }
    this.showModal = false;
    this.updated.emit();
  }

  ngOnDestroy (): void {
    this.authSubscription.unsubscribe();
    if ( this.overlayRef?.nativeElement?.parentNode === document.body ) {
      document.body.removeChild( this.overlayRef.nativeElement );
    }
  }

  // Close when clicking the dark backdrop area
  onBackdropClick ( event: MouseEvent ): void {
    event.stopPropagation();
    this.closeModal();
  }

  // Prevent clicks inside the dialog from closing the modal
  onDialogClick ( event: MouseEvent ): void {
    event.stopPropagation();
  }
}
