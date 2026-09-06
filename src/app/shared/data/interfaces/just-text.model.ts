/*****************************************************************************
*                 Taliferro License Notice
*
* The contents of this file are subject to the Taliferro License
* (the "License"). You may not use this file except in
* compliance with the License. A copy of the License is available at
* http://taliferro.com/license/
*
*
* Title: Just Text
* @author Tyrone Showers
*
* @copyright 1997-2026 Taliferro, Inc. All Rights Reserved.
*
*        Change Log
*
* Version     Date       Description
* -------   ----------  -------------------------------------------------------
*  0.1      08/17/2017  Baselined
*  0.2      04/23/2024  Upgrade to 17 and adhere to Typescript Naming 
*****************************************************************************/
export interface JustText {

  subject: string;
  body: string;
  type?: string;
  id?: string;

  lastUpdated?: any;

  company_id?: string;
  contact_id?: string;
  store_id?: string;
  offer_id?: string;
  product_id?: string;
  blog_id?: string;



}
