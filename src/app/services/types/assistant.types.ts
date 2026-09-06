// Centralized assistant types used across engine and flow services

export type AssistantUiPatch = {
    assistantResponse?: string;
    pendingAction?: { action: string; param: any; } | null;
    inlineReply?: { kind: string; payload: any; apply?: { route: string; param?: any | null; }; } | null;
    showConfirmPrompt?: boolean;
};

export type AssistantIntentResult = {
    handled: boolean;
    responseHtml?: string;
    pendingAction?: { action: string; param: any; } | null;
    route?: string | null;
    assistantResponse?: string;
    inlineReply?: any;
    showConfirmPrompt?: boolean;
};

export type AssistantMessage = { role: 'user' | 'assistant'; content: string; };

export type AssistantEngineContext = {
    rawPrompt: string;
    userId: string | null | undefined;
    externalMode: boolean;
    parentOwnsHistory: boolean;
    landingIntakeMode: boolean;
    isDemoRunning: boolean;
    tasksCount: number;
};
