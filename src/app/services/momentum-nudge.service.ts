import { Injectable } from '@angular/core';
import { Task } from '../shared/data/interfaces/task.model';

export type MomentumKind = 'contact' | 'task' | 'survey' | 'general';

export type MomentumNudge = {
  id: string;
  message: string;         // what TODD says
  action?: {               // optional CTA TODD can wire to pendingAction
    type: 'navigate' | 'addTask' | 'openSurvey';
    param: any;
  };
};


@Injectable( {
  providedIn: 'root'
} )
export class MomentumNudgeService {

  private contactQuestionCount = 0;
  private taskQuestionCount = 0;
  private surveyQuestionCount = 0;
  private lastNudgeAt = 0;    // timestamp
  private nudgeCooldownMs = 1000 * 60 * 3; // 3 minutes

  register (
    kind: MomentumKind,
    context: {
      tasks?: Task[];
      warmContactsCount?: number;
      unsentSurveyCount?: number;
    } = {}
  ): MomentumNudge | null {
    switch ( kind ) {
      case 'contact':
        this.contactQuestionCount++;
        break;
      case 'task':
        this.taskQuestionCount++;
        break;
      case 'survey':
        this.surveyQuestionCount++;
        break;
      default:
        // general
        break;
    }

    const now = Date.now();
    if ( now - this.lastNudgeAt < this.nudgeCooldownMs ) {
      return null; // don't nag
    }

    // Simple rules to start
    const overdueTasks = ( context.tasks || [] ).filter(
      t => t.dueDate && !t.isCompleted && new Date( t.dueDate ) < new Date()
    );

    if ( this.contactQuestionCount >= 3 && ( context.warmContactsCount || 0 ) > 0 ) {
      this.lastNudgeAt = now;
      this.contactQuestionCount = 0;
      return {
        id: 'warm-contacts',
        message:
          "You've been checking people a lot. Want me to show you the warmest contacts to focus on?",
        action: {
          type: 'navigate',
          param: '/contact-list?warm=true'
        }
      };
    }

    if ( this.taskQuestionCount >= 2 && overdueTasks.length > 0 ) {
      this.lastNudgeAt = now;
      this.taskQuestionCount = 0;
      return {
        id: 'overdue-tasks',
        message:
          `You’ve got ${overdueTasks.length} tasks behind. Want me to pull up what's overdue?`,
        action: {
          type: 'navigate',
          param: '/moves?filter=overdue'
        }
      };
    }

    if ( this.surveyQuestionCount >= 2 && ( context.unsentSurveyCount || 0 ) > 0 ) {
      this.lastNudgeAt = now;
      this.surveyQuestionCount = 0;
      return {
        id: 'survey-followup',
        message:
          "You’ve been thinking about feedback. Want to send a quick survey to your recent contacts?",
        action: {
          type: 'openSurvey',
          param: { template: 'quick-feedback' }
        }
      };
    }

    return null;
  }
}
