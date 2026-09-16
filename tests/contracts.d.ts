// Ambient type declarations for contract verification
declare module "@/lib/api/sseParser" {
  export interface SseRawEvent {
    event: string;
    data: string;
    id?: string;
    retry?: number;
  }

  export interface SseParserCallbacks {
    onEvent: (event: SseRawEvent) => void;
    onError?: (error: Error) => void;
  }

  export interface SseParser {
    feed: (chunk: string) => void;
    flush: () => void;
    reset: () => void;
  }

  export type SafeJsonParseResult<T> =
    | { success: true; data: T; error?: undefined }
    | { success: false; data?: undefined; error: Error };

  export function safeJsonParse<T = unknown>(text: string): SafeJsonParseResult<T>;

  export function createSseParser(callbacks: SseParserCallbacks): SseParser;
}

declare module "@/lib/api/chatStream" {
  import { SseRawEvent } from "@/lib/api/sseParser";

  export interface StreamTokenEvent {
    type: "token";
    delta: string;
  }

  export interface StreamMetadataEvent {
    type: "metadata";
    mood: string;
    intensity: number;
    affectionDelta: number;
    affectionScore: number;
    relationshipStage: string;
    characterId?: string;
    userId?: string;
  }

  export interface StreamEventUnlockedEvent {
    type: "event_unlocked";
    eventKey: string;
    context: string;
  }

  export interface StreamDoneEvent {
    type: "done";
    turnId: string;
    messageId: string;
    reply: string;
    relationship?: Record<string, unknown>;
    activeMemories?: Array<Record<string, unknown>>;
  }

  export interface StreamErrorEvent {
    type: "error";
    statusCode: number;
    message: string;
  }

  export type ChatStreamEvent =
    | StreamTokenEvent
    | StreamMetadataEvent
    | StreamEventUnlockedEvent
    | StreamDoneEvent
    | StreamErrorEvent;

  export interface StreamChatOptions {
    sessionId: string;
    content: string;
    turnId?: string;
    signal?: AbortSignal;
    baseUrl?: string;
    fetchFn?: typeof fetch;
    onEvent: (event: ChatStreamEvent) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
  }

  export function getDefaultErrorMessageForStatus(status: number): string;
  export function isAbortError(err: unknown): boolean;
  export function generateUUID(): string;
  export function dispatchSseEvent(
    rawEvent: SseRawEvent,
    ctx: {
      onEvent: (event: ChatStreamEvent) => void;
      onError?: (error: Error) => void;
      markDone: () => void;
      markError: () => void;
    }
  ): void;

  export function streamChatMessage(options: StreamChatOptions): Promise<void>;
}
