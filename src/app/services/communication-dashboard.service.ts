import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CommunicationDashboardService {

  private selectedContacts: string[] = [];

  private contactCache: any = null; // Store the data
  private emailCache: any = null; // Store the data
  private communicationDataCache: any = null;
  private campaignCache: any = null;

  private contactLastFetchedTime: Date | null = null; // Track the last fetch time
  private emailLastFetchedTime: Date | null = null; // Track the last fetch time
  private communicationDataLastFetchedTime: Date | null = null; // Track the last fetch time
  private campaignsLastFetchedTime: Date | null = null; // Track the last fetch time

  constructor() { }

  // Method to store data in the cache
  setContactData(data: any) {
    this.contactCache = data;
    this.contactLastFetchedTime = new Date(); // Update fetch time
  }

  setEmailData(data: any) {
    this.emailCache = data;
    this.emailLastFetchedTime = new Date(); // Update fetch time
  }

  setCommunicationData(data: any) {
    this.communicationDataCache = data;
    this.communicationDataLastFetchedTime = new Date(); // Update fetch time
  }

  setCampaignData(data: any) {
    this.campaignCache = data;
    this.campaignsLastFetchedTime = new Date(); // Update fetch time
  }

  // Method to get data from the cache
  getContactData(): any {
    return this.contactCache;
  }

  getEmailData(): any {
    return this.emailCache;
  }

  getCommunicationData(): any {
    return this.communicationDataCache;
  }

  getCampaignData(): any {
    return this.campaignCache;
  }

  // Method to check if cache is stale (older than 1 hour)
  isContactCacheStale(): boolean {
    if (!this.contactLastFetchedTime) return true;

    const now = new Date();
    const timeDifference = now.getTime() - this.contactLastFetchedTime.getTime();
    const oneHour = 60 * 60 * 1000; // Milliseconds in an hour

    return timeDifference > oneHour; // True if more than 1 hour has passed
  }

  isEmailCacheStale(): boolean {
    if (!this.emailLastFetchedTime) return true;

    const now = new Date();
    const timeDifference = now.getTime() - this.emailLastFetchedTime.getTime();
    const oneHour = 60 * 60 * 1000; // Milliseconds in an hour

    return timeDifference > oneHour; // True if more than 1 hour has passed
  }

  isCommunicationDataCacheStale(): boolean {
    if (!this.communicationDataLastFetchedTime) return true;

    const now = new Date();
    const timeDifference = now.getTime() - this.communicationDataLastFetchedTime.getTime();
    const oneHour = 60 * 60 * 1000; // Milliseconds in an hour

    return timeDifference > oneHour; // True if more than 1 hour has passed
  }

  isCampaignCacheStale(): boolean {
    if (!this.campaignsLastFetchedTime) return true;

    const now = new Date();
    const timeDifference = now.getTime() - this.campaignsLastFetchedTime.getTime();
    const oneHour = 60 * 60 * 1000; // Milliseconds in an hour

    return timeDifference > oneHour; // True if more than 1 hour has passed
  }

  getSelectedContacts(): string[] {
    return this.selectedContacts;
  }

  // Check if contacts array is empty
  hasContacts(): boolean {
    return this.selectedContacts.length > 0;
  }

  // Set the array of selected contacts
  setSelectedContacts(contacts: string[]): void {
    this.selectedContacts = contacts;
  }

  // Remove the first contact and return it
  shiftContact(): string | undefined {
    return this.selectedContacts.shift();
  }

  // Get the next contact in the array
  getNextContact(): string | null {
    return this.selectedContacts.length > 0 ? this.selectedContacts[0] : null;
  }

  public clearAll(): void {
    // Clear all caches
    this.contactCache = null;
    this.emailCache = null;
    this.communicationDataCache = null;
    this.campaignCache = null;

    // Clear all timestamps
    this.contactLastFetchedTime = null;
    this.emailLastFetchedTime = null;
    this.communicationDataLastFetchedTime = null;
    this.campaignsLastFetchedTime = null;

    // Clear selected contacts array
    this.selectedContacts = [];
  }

}
