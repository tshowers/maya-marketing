import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, of, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { DataService } from '../../../services/data.service';
import { ENDPOINTS } from '../../../services/endpoints';
import { Dropdown } from '../../../shared/data/interfaces/dropdown.model';
import { LoggerService } from '../../../services/logger.service';
import { AuthService } from '../../../services/auth.service';

@Component( {
  selector: 'app-input-type-ahead',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './input-type-ahead.component.html',
  styleUrl: './input-type-ahead.component.css'
} )
export class InputTypeAheadComponent implements OnInit, OnDestroy {

  @Input() collectionName!: string; // Firestore collection name
  @Input() isMultiSelect: boolean = false; // Toggle between single or multi-select
  @Input() preselectedSingleValue?: string; // Single-select preselected value
  @Input() preselectedMultiValue: any[] | undefined; // Multi-select preselected values
  @Input() showSelected: boolean = true;
  // @Input() preselectedValue: any;

  @Input() placeholder: string = 'Search...';


  @Output() selectionChange = new EventEmitter<any | any[]>(); // Emits single or multiple selected values

  inputText: string = '';
  filteredItems$: Observable<any[]> = of( [] );
  selectedItems: any[] = [];
  private subscriptions: Subscription[] = [];
  private allItems: Dropdown[] = [];
  userId!: string;
  userSubscription!: Subscription;
  preselectedItems: any;

  constructor ( private authService: AuthService, private dataService: DataService, private logger: LoggerService ) { }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUserId().subscribe( userId => {
      this.userId = userId;
      this.onCollectionInit();
      this.initSelectedItems();
    } );
  }

  ngOnDestroy (): void {
    this.subscriptions.forEach( sub => sub.unsubscribe() );
  }

  onCollectionInit (): void {
    if ( this.collectionName ) {
      this.dataService.getCollectionData( this.collectionName as keyof typeof ENDPOINTS, this.userId )
        .then( items => {
          this.allItems = items.length ? items as Dropdown[] : [];
          if ( !this.isMultiSelect && this.preselectedSingleValue )
            this.inputText = this.preselectedSingleValue;
        } )
        .catch( error => {
          this.logger.error( 'Error fetching items:', error );
          this.allItems = [];
        } );
    }
  }

  initSelectedItems () {
    if ( this.isMultiSelect ) {
      if ( this.preselectedMultiValue && this.preselectedMultiValue.length > 0 ) {
        this.preselectedMultiValue.forEach( element => {
          this.selectedItems.push( element );
        } );
      }

    } else {
      if ( this.preselectedSingleValue )
        this.selectedItems = [this.preselectedSingleValue];
    }

  }




  // Sets up dynamic filtering of items
  setupFilter (): void {
    this.filteredItems$ = of( this.inputText ).pipe(
      debounceTime( 300 ),
      distinctUntilChanged(),
      switchMap( input => this.filter( input ) )
    );
  }

  // Filters the items based on user input
  private filter ( input: string ): Observable<any[]> {
    const filterValue = input.toLowerCase();
    return of(
      this.allItems.filter( item =>
        item.name.toLowerCase().includes( filterValue ) // Adjust based on Firestore field structure
      )
    );
  }

  onInputChange ( value: string ): void {
    this.logger.info( "onInputChange" );
    this.inputText = value;
    this.setupFilter();
  }

  selectItem ( item: Dropdown ): void {
    this.logger.info( "selectItem" );
    if ( this.isMultiSelect ) {
      // Add item to the selected list if not already present
      if ( !this.selectedItems.find( selected => selected.id === item.id ) ) {
        this.selectedItems.push( item );
        this.selectionChange.emit( this.selectedItems );
      }
    } else {
      // Replace with the selected item for single-select mode
      this.selectedItems = [item];
      this.selectionChange.emit( item );
    }

    // Clear input text after selection
    this.inputText = '';

    // Re-run the filter to update dropdown list
    this.setupFilter();

  }


  removeMultiItem ( index: number ) {
    if ( this.preselectedMultiValue )
      this.preselectedMultiValue.splice( index, 1 );
  }

  // emitSelection(): void {
  //   this.selectionChange.emit(this.isMultiSelect ? this.preselectedMultiValue : this.preselectedSingleValue);
  // }

}
