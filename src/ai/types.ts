import { ProjectStorage } from '../storage/ProjectStorage';
import { Project, Character, Location, Style } from '../storage/schemas';
import { WorkspaceAIConfig } from '../storage/aiConfig';

/** A single chat round-trip, provider-agnostic (one wire format). */
export interface ChatRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** Override the configured model for this call (e.g. a fast model). */
  model?: string;
  /** Override the request timeout in ms (defaults are provider-aware). */
  timeoutMs?: number;
}

export interface ChatResponse {
  text: string;
  /** Reasoning-model chain-of-thought, stripped from `text` (for debug view only). */
  reasoning?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type CallModel = (req: ChatRequest) => Promise<ChatResponse>;

/** A per-run sink the harness threads through ToolContext so reasoning/raw
 *  output from each model call can be surfaced in the panel's debug view. */
export interface DebugSink {
  reasoning: string;
  raw: string;
}

/** Everything an action's `propose` or write-op's `execute` is allowed to touch. Assembled by the caller. */
export interface ToolContext {
  storage: ProjectStorage;
  project: Project;
  /** `projects/${id}/` — the per-project storage prefix. */
  prefix: string;
  /** Prose language (`project.language`); drives the prompt pack. */
  lang: string;
  callModel: CallModel;
  /** Ordered chapter IDs — used to resolve the preceding chapter's continuity. */
  chapterOrder: string[];

  // React state synchronization callbacks
  onUpdateCharacters?: (list: Character[]) => void;
  onUpdateLocations?: (list: Location[]) => void;
  onUpdateStyle?: (style: Style) => void;
  /** Called after every continuity write; the page derives the synopsis cache from the new content. */
  onUpdateContinuity?: (chapterId: string, content: string) => Promise<void>;

  /** Optional debug sink; `callModel` appends each call's reasoning/raw output. */
  debug?: DebugSink;
}

export interface ToolResult<O = unknown> {
  ok: boolean;
  output?: O;
  warnings: string[];
  error?: string;
  /** Reasoning captured during the run, for the panel's debug view. */
  reasoning?: string;
  estimatedInputTokens?: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
}

export type ToolLevel = 1 | 2 | 3 | 4 | 5;

export interface ParamSpec {
  name: string;
  label: string;
  type: 'text' | 'choice' | 'number';
  choices?: string[];
  default?: string | number;
}

export interface WriteOpProposal {
  op: string; // e.g. 'character_add'
  args: unknown;
}

export interface ReportItem {
  severity: 'high' | 'medium' | 'low';
  statement: string;
  conflict: string;
}

export interface Report {
  type: 'report';
  items: ReportItem[];
}

export interface TextResult {
  type: 'text';
  text: string;
  /** Optional write-op to propose applying this text (e.g. append_continuity) */
  suggestedOp?: WriteOpProposal;
}

export type ProposalResult =
  | { type: 'proposals'; list: WriteOpProposal[] }
  | Report
  | TextResult;

export interface Action<I = unknown> {
  id: string;
  label: string;
  description: string;
  level: ToolLevel;
  scope: 'chapter' | 'selection';
  params?: ParamSpec[];
  allow: string[]; // write-op ids this action may produce
  propose(input: I, ctx: ToolContext): Promise<ProposalResult>;
}

export interface LevelModule {
  level: ToolLevel;
  label: string;
  blurb: string;
  actions: Action[];
}

export interface WriteOp<A = unknown> {
  id: string;
  level: ToolLevel;
  validate(args: unknown): { ok: boolean; value?: A; error?: string };
  describe(args: A, ctx: ToolContext): { title: string; preview: string; kind: 'addition' | 'update' | 'edit' };
  execute(args: A, ctx: ToolContext): Promise<void>;
}

// ---- Level 1 input/output shapes -------------------------------------------

export interface CaptureInput {
  selection: { text: string; from?: number; to?: number };
  chapterId: string;
  hint?: string;
  params?: Record<string, string | number>;
}

export type CharacterDraft = Partial<Character> & { name: string };
export type LocationDraft = Partial<Location> & { name: string };
export type StyleFieldDelta = { path: string; label: string; value: string };

export interface SummarizeChapterInput {
  chapterId: string;
  params?: Record<string, string | number>;
}

export interface CheckContinuityInput {
  chapterId: string;
  params?: Record<string, string | number>;
}

// ---- Errors ----------------------------------------------------------------

export class AIDisabledError extends Error {
  constructor(message = 'AI is off (Level 0).') {
    super(message);
    this.name = 'AIDisabledError';
  }
}

export class AILevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AILevelError';
  }
}

export type { Style, WorkspaceAIConfig };
