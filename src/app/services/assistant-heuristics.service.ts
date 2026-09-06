import { Injectable } from '@angular/core';

@Injectable( { providedIn: 'root' } )
export class AssistantHeuristicsService {
    isNextStepQuestion ( prompt: string ): boolean {
        const p = ( prompt || '' ).trim().toLowerCase();
        if ( !p ) return false;
        const nextRe = /\b(what\s+should\s+i\s+do\s+next|what\s+do\s+i\s+do\s+next|what\s+should\s+i\s+be\s+doing\s+next|tell\s+me\s+what\s+i\s+should\s+do\s+next|tell\s+me\s+what\s+i\s+should\s+be\s+doing\s+next|next\s+step|next\s+move|next\s+best\s+move|what\s+do\s+i\s+do\s+now|what\s+should\s+i\s+do\s+now|what\s+now|what\s+should\s+i\s+do\s+today)\b/i;
        return nextRe.test( p );
    }

    isQuickGuidancePill ( prompt: string ): boolean {
        const p = ( prompt || '' ).trim();
        if ( !p ) return false;
        const norm = p.toLowerCase().replace( /\u2019/g, "'" );
        const pills = [
            "what's the smartest move?",
            "who's gone quiet?",
            'where are we stuck?',
            "what's overdue?",
            'draft follow-ups',
            'surface stalled deals',
            'clean up data',
            'create motion',
        ];
        return pills.includes( norm );
    }
}
