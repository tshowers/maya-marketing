/*****************************************************************************
*                 Taliferro License Notice
*
* The contents of this file are subject to the Taliferro License
* (the "License"). You may not use this file except in
* compliance with the License. A copy of the License is available at
* http://taliferro.com/license/
*
*
* Title: Data State Interface
* @author Tyrone Showers
*
* @copyright 1997-2026 Taliferro, Inc. All Rights Reserved.
*
*        Change Log
*
* Version     Date       Description
* -------   ----------  -------------------------------------------------------
*  0.1      08/17/2017  Baselined
*  0.2      09/17/2017  Added user ID/ person who created the record
*  0.3      04/23/2024  Upgrade to 17 and adhere to Typescript Naming 
*****************************************************************************/
export interface State {

   $key?: string;
   id?: string;
   dateAdded?: { seconds: number; } | string;

   payoutProfileComplete?: boolean;
   payoutProfileCompletedAt?: string;

   userId?: string;
   lastUpdated?: string;
   lastUpdatedBy?: string;
   creatorName?: string;
   deleted?: boolean;
   notEngaged?: boolean;
   notEngagedReason?: string;
   notEngagedAt?: any;

   draft?: boolean;
   views?: number;
   lastViewed?: string;
   keywords?: string;
   company_id?: string;
   timeStamp?: Date;

   // Social Media
   bookmarked?: boolean;
   bookmarkedCount?: number;
   favored?: boolean;
   favoredCount?: number;
   broadcasted?: boolean;
   broadcastedCount?: number;


}
