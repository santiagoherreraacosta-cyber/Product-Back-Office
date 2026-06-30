export type PhaseState = 'done' | 'active' | 'todo';
export type View = 'home' | 'workspace' | 'library' | 'context';
export type Deliverable = 'brief' | 'experiment';

export interface Phase {
  key: string;
  label: string;
  state: PhaseState;
  note?: string;
  skipped?: boolean;
}

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content?: string;
  variant?: 'diagnosis' | 'gate';
}
