/*****************************************************************************
*                 Taliferro License Notice
*
* The contents of this file are subject to the Taliferro License
* (the "License"). You may not use this file except in
* compliance with the License. A copy of the License is available at
* http://taliferro.com/license/
*
*
* Title: Task
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
import { Contact } from './contact.model';
import { TaTime } from './ta-date.model';
import { Image } from './image.model';
import { Document } from './docuttach.model';
import { State } from './state.model';
import { EmployeeActionNoteEntry } from '../../../features/employees/models/employee.models';


export interface Task extends State {
  id?: string;

  title: string;
  description?: string;

  taskTypeId?: string;
  projectId?: string;
  parentTaskId?: string;

  dueDate: string;
  startDate?: string;
  timerStartTime?: string;
  timerEndTime?: string;

  progress: number;
  priority?: string;
  status?: string;

  isEditing?: boolean;
  isCompleted?: boolean;
  needsAttention?: boolean;
  superseded?: boolean;
  supersededAt?: string;
  supersededReason?: string;

  contactIds?: string[];
  contacts?: Contact[];

  images?: Image[];
  documents?: Document[];
  subTasks?: Task[];

  extensionDays?: number;
  timeToComplete?: TaTime;
  url?: string;

  createdAt?: string;
  updatedAt?: string;
  ownerId?: string;
  /** Tenant member responsible for the move. Contacts remain related records. */
  assigneeId?: string;
  tenantId?: string;
  source?: string;
  createdByTodd?: boolean;
  toddSourceActionKey?: string;
  employeeId?: string;
  employeeType?: string;
  executionLane?: string;
  taskKind?: string;
  plannedForDate?: string;
  // Mirrored outward from the source employee-action's notesLog (Maya's
  // status/blocker notes interleaved with human replies) - never written
  // to directly by the daily/midday sync in the overwrite direction, see
  // syncMoveForAction. Human replies go through a dedicated append endpoint
  // that writes to the source action, not this field directly.
  notesLog?: EmployeeActionNoteEntry[];
  // Mirrored from the source action's own `blocked` flag (see
  // EmployeeActionRecord.blocked) - true only when Maya's midday self-check
  // reported something only a human can unblock.
  blocked?: boolean;
}

export interface TaskType {
  id: string;
  name: string;
}
