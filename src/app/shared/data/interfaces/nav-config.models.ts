export interface NavChild {
  label: string;
  route: string;
  description?: string;
}

export interface NavItem {
  label: string;           // e.g., "Network"
  icon: string;            // asset path
  route: string;           // primary route
  feature: 'contact' | 'communication' | 'survey' | 'documents' | 'tasks' | 'settings' | 'tour' | 'assistant' | string;
  description?: string;
  children?: NavChild[];
}

export interface QuickAction {
  label: string;           // short chip label
  route: string;
  hint?: string;           // tooltip/ariaDescription
  icon?: string;           // optional small glyph
}