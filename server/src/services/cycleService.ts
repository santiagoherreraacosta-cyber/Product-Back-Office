import { randomUUID } from "node:crypto";

export type Phase = "F0" | "F1" | "F2" | "F3" | "F4" | "F5";
export type CycleStatus = "active" | "paused" | "completed" | "archived";
export type RiskLevel = "low" | "medium" | "high";
export type BMapCause = "Motivation" | "Ability" | "Prompt" | "Unknown";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  phase: Phase;
  createdAt: string;
  actions?: StructuredAction[];
}

export interface StructuredAction {
  type: "update_cycle" | "create_deliverable" | "request_evidence" | "advance_phase" | "flag_risk";
  label: string;
  payload?: Record<string, unknown>;
}

export interface Deliverables {
  brief?: Record<string, unknown>;
  experiment?: Record<string, unknown>;
}

export interface Cycle {
  id: string;
  teamId: string;
  userId: string;
  title: string;
  phase: Phase;
  status: CycleStatus;
  risk: RiskLevel;
  subprofile?: string;
  cognitiveTransition?: string;
  bmapCause: BMapCause;
  context: Record<string, unknown>;
  deliverables: Deliverables;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCycleInput {
  teamId?: string;
  userId?: string;
  title?: string;
  context?: Record<string, unknown>;
}

export interface UpdateCycleInput {
  phase?: Phase;
  risk?: RiskLevel;
  subprofile?: string;
  cognitiveTransition?: string;
  status?: CycleStatus;
  bmapCause?: BMapCause;
  context?: Record<string, unknown>;
  deliverables?: Deliverables;
}

const now = () => new Date().toISOString();
const cycles = new Map<string, Cycle>();

export function createCycle(input: CreateCycleInput = {}): Cycle {
  const timestamp = now();
  const cycle: Cycle = {
    id: randomUUID(),
    teamId: input.teamId ?? "default-team",
    userId: input.userId ?? "default-user",
    title: input.title ?? "Nuevo ciclo Dropi",
    phase: "F0",
    status: "active",
    risk: "low",
    bmapCause: "Unknown",
    context: input.context ?? {},
    deliverables: {},
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  cycles.set(cycle.id, cycle);
  return cycle;
}

export function listCycles(filters: { teamId?: string; userId?: string } = {}): Cycle[] {
  return [...cycles.values()]
    .filter((cycle) => !filters.teamId || cycle.teamId === filters.teamId)
    .filter((cycle) => !filters.userId || cycle.userId === filters.userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCycle(id: string): Cycle | undefined {
  return cycles.get(id);
}

export function updateCycle(id: string, input: UpdateCycleInput): Cycle | undefined {
  const cycle = cycles.get(id);
  if (!cycle) return undefined;
  const updated: Cycle = {
    ...cycle,
    ...input,
    context: { ...cycle.context, ...(input.context ?? {}) },
    deliverables: { ...cycle.deliverables, ...(input.deliverables ?? {}) },
    updatedAt: now(),
  };
  cycles.set(id, updated);
  return updated;
}

export function addMessage(cycleId: string, message: Omit<Message, "id" | "createdAt">): Message {
  const cycle = getCycle(cycleId);
  if (!cycle) throw new Error("Cycle not found");
  const entry: Message = { id: randomUUID(), createdAt: now(), ...message };
  cycle.messages.push(entry);
  cycle.updatedAt = entry.createdAt;
  cycles.set(cycleId, cycle);
  return entry;
}
