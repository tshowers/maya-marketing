import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DataService } from '../../../services/data.service';
import { LoggerService } from '../../../services/logger.service';
import { OutreachApiService } from '../../../services/outreach-api.service';

@Component( {
  selector: 'app-email-sending-status',
  imports: [CommonModule],
  templateUrl: './email-sending-status.component.html',
  styleUrl: './email-sending-status.component.css'
} )
export class EmailSendingStatusComponent implements OnChanges {

  @Input() userId!: string;
  emailState!: any;

  constructor ( private dataService: DataService, private logger: LoggerService, private outreachApiService: OutreachApiService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['userId'] && this.userId ) {
      void this.emailStatus();
    }
  }

  private async emailStatus () {
    const rawState = await this.dataService.getEmailWarmupState(
      this.userId || 'unknown'
    );

    const warmupStatus = this.computeWarmupStatus( rawState );

    // The cap/used numbers must come from the real, operator-configured
    // Daily Auto-Send Cap (what actually gates a send), not the campaign
    // warmup ramp above - that curve belongs to the retired campaign-sending
    // system. Everything else (level, campaign hint) still reflects the
    // warmup state, which wasn't reported as wrong.
    try {
      const capResponse = await firstValueFrom(
        this.outreachApiService.getAutoSendCapStatus( { tenantId: this.userId || 'unknown' } )
      );
      const capData = capResponse?.data;
      if ( capData ) {
        warmupStatus.capForToday = capData.dailyAutoSendTarget;
        warmupStatus.usedToday = capData.sentToday;
      }
    } catch ( error ) {
      this.logger.error( '[EmailSendingStatus] getAutoSendCapStatus failed', error );
    }

    this.emailState = warmupStatus;
    this.logger.info( "WARMUP STATUS:", this.emailState );
  }

  private computeWarmupStatus ( state: any ) {
    const now = new Date();
    const todayKey = now.toISOString().slice( 0, 10 );

    const BASE_WARMUP_CAPS = [25, 35, 50, 75, 100, 125];

    // Same curve as backend getCapForDay()
    const getCapForDay = ( dayIndex: number ): number => {
      if ( dayIndex < BASE_WARMUP_CAPS.length ) {
        return BASE_WARMUP_CAPS[dayIndex]; // 0–5 → 25..125
      }
      if ( dayIndex < 14 ) {
        return 250; // Days 6–13
      }
      if ( dayIndex < 30 ) {
        return 500; // Days 14–29
      }
      if ( dayIndex < 45 ) {
        return 1000; // Days 30–44
      }
      if ( dayIndex < 60 ) {
        return 1500; // Days 45–59
      }
      return 2500; // Day 60+
    };

    // No state or no warmupStartDate → cold, no activity yet
    if ( !state || !state.warmupStartDate ) {
      return {
        level: 'cold',
        dayIndex: 0,
        idleTooLong: true,
        capForToday: BASE_WARMUP_CAPS[0],
        usedToday: 0,
      };
    }

    // Prefer lastDeliveredAt (real sends), then lastActiveAt, then warmupStartDate
    const lastActivityIso: string | null =
      state.lastDeliveredAt ||
      state.lastActiveAt ||
      ( state.warmupStartDate
        ? state.warmupStartDate + 'T00:00:00Z'
        : null );

    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const idleTooLong =
      !lastActivityIso ||
      ( now.getTime() - new Date( lastActivityIso ).getTime() ) > TWO_DAYS_MS;

    const warmupStartDate = new Date( state.warmupStartDate + 'T00:00:00Z' );
    const dayIndex = Math.max(
      0,
      Math.floor(
        ( now.getTime() - warmupStartDate.getTime() ) / ( 24 * 60 * 60 * 1000 )
      )
    );

    const capForToday = getCapForDay( dayIndex );
    const usedToday = state.perDayCounts?.[todayKey] || 0;

    // Derive a separate status for campaign activity (when campaigns were last started/resumed)
    const lastCampaignIso: string | null =
      state.lastActiveAt ||
      ( state.warmupStartDate
        ? state.warmupStartDate + 'T00:00:00Z'
        : null );

    let campaignStatus: 'none' | 'recent' | 'stale' = 'none';
    let daysSinceCampaign: number | null = null;

    if ( lastCampaignIso ) {
      const msSinceCampaign = now.getTime() - new Date( lastCampaignIso ).getTime();
      daysSinceCampaign = Math.floor( msSinceCampaign / ( 24 * 60 * 60 * 1000 ) );

      if ( daysSinceCampaign <= 2 ) {
        campaignStatus = 'recent'; // campaigns started/resumed in the last couple of days
      } else if ( daysSinceCampaign <= 7 ) {
        campaignStatus = 'stale'; // some days since a new campaign, but not long enough to be considered inactive
      } else {
        campaignStatus = 'none'; // it has been a long time since a new campaign was started
      }
    }

    let level: 'cold' | 'warming' | 'ready' = 'cold';
    if ( idleTooLong ) {
      level = 'cold';
    } else if ( dayIndex < 2 ) {
      level = 'warming';
    } else {
      level = 'ready';
    }

    return {
      level,
      dayIndex,
      idleTooLong,
      capForToday,
      usedToday,
      lastActivityIso,
      campaignStatus,
      daysSinceCampaign,
    };
  }

  get statusLabel (): string {
    if ( !this.emailState ) return '';
    return this.emailState.level === 'cold'
      ? 'Not Ready Yet'
      : this.emailState.level === 'warming'
        ? 'Building Sending Reputation'
        : 'Ready to Send';
  }

  get statusTitle (): string {
    if ( !this.emailState ) return '';
    return this.emailState.level === 'cold'
      ? 'Your email account is too new to send email out in bulk. We start slowly so providers do not flag you as spam.'
      : this.emailState.level === 'warming'
        ? 'We are gradually increasing how many emails you can send so inbox providers trust your messages.'
        : 'Your sending reputation is established. You can now send full campaigns safely.';
  }

  get campaignHintText (): string {
    if ( !this.emailState ) return '';
    if ( this.emailState.campaignStatus === 'recent' ) return 'Campaigns active. Emails are still sending from recent campaigns.';
    if ( this.emailState.campaignStatus === 'stale' ) return 'Emails are sending, but no new campaigns in a few days.';
    return 'No recent campaigns. Start a new one to keep momentum going.';
  }

}
