import { CommonModule } from '@angular/common';
import { Component, HostBinding, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';

import { ModuleInstallService } from '../../../services/module-install.service';
import { ModuleInstallConfig } from '../../utils/module-install-config.util';

@Component( {
  selector: 'app-module-install-cta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './module-install-cta.component.html',
  styleUrl: './module-install-cta.component.css'
} )
export class ModuleInstallCtaComponent implements OnChanges, OnDestroy {
  @Input() installConfig: ModuleInstallConfig | null = null;
  @Input() variant: 'banner' | 'inline' = 'banner';

  @HostBinding( 'class.is-inline' ) get isInline (): boolean {
    return this.variant === 'inline';
  }

  readonly installState$ = inject( ModuleInstallService ).state$;
  private readonly installService = inject( ModuleInstallService );

  showIosInstructions = false;

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['installConfig'] ) {
      this.installService.activateConfig( this.installConfig );
    }
  }

  ngOnDestroy (): void {
    this.installService.deactivateConfig( this.installConfig );
  }

  async onInstallClick (): Promise<void> {
    const state = this.installService.getSnapshot();
    if ( state.canPrompt ) {
      await this.installService.promptInstall();
      return;
    }

    if ( state.isIosSafari ) {
      this.showIosInstructions = true;
    }
  }

  closeIosInstructions (): void {
    this.showIosInstructions = false;
  }
}
