import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Shared Taliferro Tech loading treatment, branded for Maya. */
@Component( {
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preloader.component.html',
  styleUrl: './preloader.component.css',
} )
export class PreloaderComponent implements OnInit {
  @Input() isLoading = false;
  @Input() message = '';
  @Input() autoHideAfterMs: number | null = 15000;
  @Input() brandName = '';
  @Input() brandSubtext = '';
  /** Compact, non-overlay mode for widgets/cards/panels — no fixed positioning, no orbit animation. */
  @Input() inline = false;

  ngOnInit (): void {
    this.brandName = this.brandName || 'Maya';
    this.brandSubtext = this.brandSubtext || 'Marketing Director';

    if ( this.autoHideAfterMs && this.autoHideAfterMs > 0 ) {
      setTimeout( () => {
        this.isLoading = false;
      }, this.autoHideAfterMs );
    }
  }
}
