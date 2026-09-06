import { Component, OnInit, OnDestroy, ViewChild, HostListener, Input, ElementRef } from '@angular/core';
import { Dropdown } from '../../../shared/data/interfaces/dropdown.model';
import { DataService } from '../../../services/data.service';
import { ENDPOINTS, DROPDOWN_ENDPOINTS, DropdownEndpointKeys } from '../../../services/endpoints';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormatKeyPipe } from '../../../shared/pipes/format-key.pipe';
import { LoggerService } from '../../../services/logger.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { SoundService } from '../../../services/sound.service';
import { Router, RouterModule } from '@angular/router';
import { DiagnosticComponent } from '../../../shared/page/diagnostic/diagnostic.component';

import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../services/notification.service';
import { PageActionsService } from '../../../services/page-actions.service';
import { PageAction } from '../../../shared/data/interfaces/page-actions.models';
import { PreloaderComponent } from '../../../shared/page/preloader/preloader.component';


@Component( {
  selector: 'app-dropdown-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatKeyPipe, RouterModule, PreloaderComponent],
  templateUrl: './dropdown-manager.component.html',
  styleUrl: './dropdown-manager.component.css'
} )
export class DropdownManagerComponent implements OnInit, OnDestroy {
  @Input() isModal: boolean = false;
  @Input() preselectedCollection?: DropdownEndpointKeys;

  @ViewChild( 'diagnosticRef' ) diagnosticComponent!: DiagnosticComponent;
  @ViewChild( 'addInput' ) addInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild( 'dropdownContent' ) dropdownContentRef?: ElementRef<HTMLElement>;
  version: string = environment.VERSION;
  companyName: string = environment.COMPANY_NAME;

  collections: DropdownEndpointKeys[] = [...DROPDOWN_ENDPOINTS]; // Convert readonly array to mutable array
  selectedCollection: DropdownEndpointKeys | null = null;
  newItem: Dropdown = { id: '', name: '' };
  dropdownItems: Dropdown[] = [];
  userSubscription!: Subscription;
  userId!: string;
  message!: string;
  isLoading: boolean = false;
  isMobile: boolean = window.innerWidth < 768; // Initialize based on current width
  recentlyFocusedCollection: DropdownEndpointKeys | null = null;
  selectionFeedbackMessage = '';
  isAuthenticated = false;
  private selectionFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor ( private dataService: DataService,
    private router: Router,
    private notificationService: NotificationService,
    private soundService: SoundService, private logger: LoggerService, private authService: AuthService,
    private pageActionsService: PageActionsService ) { }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId;
      this.isAuthenticated = !!userId && userId !== 'user not logged in';

      // If this component is used in a modal with a preselected collection,
      // immediately load that collection.
      if ( this.preselectedCollection && this.isAuthenticated ) {
        this.selectedCollection = this.preselectedCollection;
        this.onCollectionChange();
      }

      if ( !this.isModal ) {
        this.publishPageActions();
      }
    } );
  }

  ngOnDestroy (): void {
    if ( this.userSubscription )
      this.userSubscription.unsubscribe();
    if ( this.selectionFeedbackTimeoutId ) {
      clearTimeout( this.selectionFeedbackTimeoutId );
    }

    this.pageActionsService.clearPageActions( 'dropdown-manager' );
  }

  onCollectionSelected ( collection: DropdownEndpointKeys ): void {
    if ( !this.ensureAuthenticated( 'select dropdowns to edit' ) ) {
      return;
    }
    this.selectedCollection = collection;
    this.showSelectionFeedback( collection );
    this.onCollectionChange();
  }

  onCollectionChange (): void {
    if ( !this.isAuthenticated ) {
      this.dropdownItems = [];
      return;
    }

    if ( !this.isModal ) {
      this.publishPageActions();
    }

    if ( this.selectedCollection ) {
      this.dataService.getCollectionData( this.selectedCollection as keyof typeof ENDPOINTS, this.userId )
        .then( items => {
          this.dropdownItems = ( items.length ? items as Dropdown[] : [] )
            .slice()
            .sort( ( a, b ) =>
              ( a.name || '' ).localeCompare( ( b.name || '' ), undefined, { sensitivity: 'base' } )
            );
          this.focusCollectionEditor();
          this.notificationService.show( "Collection Change", 'Now working with dropdown list:' + this.selectedCollection, 'success' );

        } )
        .catch( error => {
          this.logger.error( 'Error fetching items:', error );
          this.dropdownItems = [];
          this.notificationService.show( "Error", 'Error fetching items:' + JSON.stringify( error ), 'error' );
        } );
    }
  }

  goNext (): void {
    this.router.navigate( ['/contact-import'] );
  }

  addItem (): void {
    this.soundService.playSound( "click" );
    if ( !this.ensureAuthenticated( 'add dropdown options' ) ) {
      return;
    }

    if ( this.selectedCollection ) {
      this.dataService.addDocument( this.selectedCollection as keyof typeof ENDPOINTS, this.newItem, this.userId )
        .then( id => {
          if ( id ) {
            this.newItem.id = id as string;
            this.dropdownItems.push( { ...this.newItem } );
            this.dropdownItems = this.dropdownItems
              .slice()
              .sort( ( a, b ) =>
                ( a.name || '' ).localeCompare( ( b.name || '' ), undefined, { sensitivity: 'base' } )
              );
            this.newItem = { id: '', name: '' };
            this.notificationService.show( "Success", 'Item added', 'success' );
          } else {
            this.logger.error( 'Error: Document ID is undefined.' );
            this.notificationService.show( "Error", 'Error: Document ID is undefined.', 'error' );
          }
        } )
        .catch( error => {
          this.logger.error( 'Error adding item:', error );
          this.notificationService.show( "Error", 'Error: adding item' + JSON.stringify( error ), 'error' );
        } );
    } else {
      this.logger.error( 'No collection selected.' );
      this.notificationService.show( "Error", 'No collection selected.', 'error' );
    }
  }

  @HostListener( 'window:resize', [] )
  onResize () {
    this.isMobile = window.innerWidth < 768;
  }
  onClickRoute ( goto: string ) {
    const [path, fragment] = goto.split( '#' );
    this.router.navigate( [path], { fragment } );
  }

  private focusCollectionEditor (): void {
    if ( !this.selectedCollection ) {
      return;
    }

    this.recentlyFocusedCollection = this.selectedCollection;
    this.showSelectionFeedback( this.selectedCollection );

    setTimeout( () => {
      if ( this.isMobile ) {
        this.dropdownContentRef?.nativeElement.scrollIntoView( {
          behavior: 'smooth',
          block: 'end',
        } );
        this.scrollMobileEditorToBottom();
        return;
      }

      this.addInputRef?.nativeElement.focus();
    }, 0 );
  }

  private scrollMobileEditorToBottom (): void {
    const scrollToPageBottom = ( behavior: ScrollBehavior ) => {
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );

      const bottomTarget = Math.max( 0, documentHeight - window.innerHeight );

      window.scrollTo( {
        top: bottomTarget,
        behavior,
      } );
    };

    scrollToPageBottom( 'smooth' );

    setTimeout( () => {
      scrollToPageBottom( 'smooth' );
      this.addInputRef?.nativeElement.scrollIntoView( {
        behavior: 'smooth',
        block: 'end',
      } );
    }, 180 );

    setTimeout( () => {
      scrollToPageBottom( 'auto' );
      this.addInputRef?.nativeElement.focus();
    }, 420 );

    setTimeout( () => {
      scrollToPageBottom( 'auto' );
      this.addInputRef?.nativeElement.scrollIntoView( {
        behavior: 'auto',
        block: 'end',
      } );
    }, 700 );
  }

  private showSelectionFeedback ( collection: DropdownEndpointKeys ): void {
    this.selectionFeedbackMessage = `Editing ${collection} below`;

    if ( this.selectionFeedbackTimeoutId ) {
      clearTimeout( this.selectionFeedbackTimeoutId );
    }

    this.selectionFeedbackTimeoutId = setTimeout( () => {
      this.selectionFeedbackMessage = '';
      this.selectionFeedbackTimeoutId = null;
    }, 2200 );
  }

  toggleDiagnosticInChild () {
    if ( this.diagnosticComponent ) {
      this.diagnosticComponent.toggleDiagnostic();
    }
  }

  updateItem ( item: Dropdown ): void {
    if ( !this.ensureAuthenticated( 'edit dropdown options' ) ) {
      return;
    }

    if ( this.selectedCollection ) {
      this.dataService.updateDocument( this.selectedCollection as keyof typeof ENDPOINTS, item.id, item, 'admin' )
        .then( () => {
          this.dropdownItems = this.dropdownItems
            .slice()
            .sort( ( a, b ) =>
              ( a.name || '' ).localeCompare( ( b.name || '' ), undefined, { sensitivity: 'base' } )
            );
          this.message = ( 'Item updated successfully.' );
          this.notificationService.show( "Success", 'Item updated successfully.', 'success' );

        } )
        .catch( error => {
          this.logger.error( 'Error updating item:', error );
          this.notificationService.show( "Error", 'Error updating item:' + JSON.stringify( error ), 'error' );

        } );
    }
  }

  deleteItem ( itemId: string ): void {
    this.soundService.playSound( "click" );
    if ( !this.ensureAuthenticated( 'delete dropdown options' ) ) {
      return;
    }

    this.message = ( "Attempting to delete " + itemId );
    if ( this.selectedCollection ) {
      this.dataService.deleteDocument( this.selectedCollection as keyof typeof ENDPOINTS, itemId, 'admin' )
        .then( () => {
          this.dropdownItems = this.dropdownItems.filter( item => item.id !== itemId );
          this.notificationService.show( "Success", 'Item deleted successfully.', 'success' );
        } )
        .catch( error => {
          this.logger.error( 'Error deleting item:', error );
          this.notificationService.show( "Error", 'Error deleting item:' + JSON.stringify( error ), 'error' );
        } );
    }
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'dropdown-manager',
      context: {
        pageId: 'dropdown-manager',
        feature: 'security',
        mode: this.selectedCollection ?? undefined,
        extra: {
          selectedCollection: this.selectedCollection ?? null,
        },
      },
      actions: this.buildPageActions(),
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'dropdown-import-contacts',
        label: 'Import Contacts',
        icon: 'fa-solid fa-file-import',
        kind: 'route',
        route: '/contact-import',
        order: 10,
        group: 'context',
      },
      {
        id: 'dropdown-settings',
        label: 'Settings',
        icon: 'fa-solid fa-cog',
        kind: 'route',
        route: '/settings',
        order: 20,
        group: 'context',
      },
      {
        id: 'dropdown-profile',
        label: 'Profile',
        icon: 'fa-solid fa-user-pen',
        kind: 'route',
        route: '/update-profile',
        order: 30,
        group: 'context',
      },
      {
        id: 'dropdown-billing',
        label: 'Billing',
        icon: 'fa-solid fa-credit-card',
        kind: 'route',
        route: '/billing',
        order: 40,
        group: 'context',
      },
      {
        id: 'dropdown-help',
        label: 'Help',
        icon: 'fa-solid fa-circle-question',
        kind: 'route',
        route: '/help',
        fragment: 'dropdown-manager',
        order: 50,
        group: 'context',
      },
    ];
  }

  private ensureAuthenticated ( action: string ): boolean {
    if ( this.isAuthenticated ) {
      return true;
    }

    this.notificationService.show( 'Sign in required', `You must be logged in to ${action}.`, 'info' );
    return false;
  }

}
