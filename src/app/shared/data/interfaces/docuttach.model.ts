/*****************************************************************************
*                 Taliferro License Notice
*
* The contents of this file are subject to the Taliferro License
* (the "License"). You may not use this file except in
* compliance with the License. A copy of the License is available at
* http://taliferro.com/license/
*
*
* Title: Alert
* @author Tyrone Showers
*
* @copyright 1997-2026 Taliferro, Inc. All Rights Reserved.
*
*        Change Log
*
* Version     Date       Description
* -------   ----------  -------------------------------------------------------
*  0.1      11/22/2017  Baselined
*  0.2      04/23/2024  Upgrade to 17 and adhere to Typescript Naming 
*****************************************************************************/
export interface Document {
  id?: any;
  src: string;
  name: string;
  title?: string;
  topic?: string;
  author?: string;
  type: 'document' | 'image' | 'video' | 'draft' | 'rfp' | 'proposal';
  recordKind?: 'upload' | 'draft';
  htmlContent?: string;
  uploadDate?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  dueDate?: any;
  contactId?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  ownerId?: string;
  tenantId?: string;
  isPendingUpload?: boolean;
  summary?: string;
  description?: string;
  socialPostHistory?: { platform: string; postedAt: string; postUrl?: string }[];
  lastPostedAt?: string | null;
  lastPostedPlatforms?: string[];
  eligibleForSocial?: boolean;
}


