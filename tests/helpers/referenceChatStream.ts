/**
 * tests/helpers/referenceChatStream.ts
 *
 * Authoritative reference implementation / oracle of the streaming transport client
 * strictly matching PROJECT.md and ORIGINAL_REQUEST.md contracts.
 */

import { createSseParser, SseRawEvent } from "./referenceParser";

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

export function getDefaultErrorMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Yêu cầu không hợp lệ. Vui lòng kiểm tra lại nội dung tin nhắn.";
    case 401:
      return "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.";
    case 403:
      return "Bạn không có quyền truy cập phòng trò chuyện này.";
    case 404:
      return "Không tìm thấy phòng trò chuyện này.";
    case 409:
      return "Xung đột cập nhật dữ liệu. Vui lòng thử lại với cùng lượt tương tác.";
    case 429:
      return "Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau giây lát.";
    default:
      if (status >= 500 && status < 600) {
        return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.";
      }
      return "Không thể gửi tin nhắn đến máy chủ. Vui lòng thử lại!";
  }
}

export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    if ("name" in err && (err as { name: string }).name === "AbortError") {
      return true;
    }
    if (
      "message" in err &&
      typeof (err as { message: string }).message === "string" &&
      (err as { message: string }).message.toLowerCase().includes("abort")
    ) {
      return true;
    }
  }
  return false;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getLocalAuthHeader(): Record<string, string> {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const token = localStorage.getItem("nyxoris_auth_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

interface DispatchContext {
  onEvent: (event: ChatStreamEvent) => void;
  onError?: (error: Error) => void;
  markDone: () => void;
  markError: () => void;
}

export function dispatchSseEvent(rawEvent: SseRawEvent, ctx: DispatchContext): void {
  const eventName = (rawEvent.event || "").trim();
  const rawData = rawEvent.data;

  switch (eventName) {
    case "token": {
      let delta = "";
      try {
        const parsed = JSON.parse(rawData);
        if (parsed && typeof parsed === "object" && typeof parsed.delta === "string") {
          delta = parsed.delta;
        } else if (typeof parsed === "string") {
          delta = parsed;
        } else {
          delta = rawData;
        }
      } catch {
        delta = rawData;
      }
      ctx.onEvent({
        type: "token",
        delta,
      });
      break;
    }

    case "metadata": {
      try {
        const parsed = JSON.parse(rawData);
        ctx.onEvent({
          type: "metadata",
          mood: String(parsed.mood || ""),
          intensity: Number(parsed.intensity ?? 0),
          affectionDelta: Number(parsed.affectionDelta ?? 0),
          affectionScore: Number(parsed.affectionScore ?? 0),
          relationshipStage: String(parsed.relationshipStage || ""),
          characterId: parsed.characterId ? String(parsed.characterId) : undefined,
          userId: parsed.userId ? String(parsed.userId) : undefined,
        });
      } catch (err) {
        console.warn("[chatStream] Failed to parse metadata event data:", err, rawData);
      }
      break;
    }

    case "event_unlocked": {
      try {
        const parsed = JSON.parse(rawData);
        ctx.onEvent({
          type: "event_unlocked",
          eventKey: String(parsed.eventKey || ""),
          context: String(parsed.context || ""),
        });
      } catch (err) {
        console.warn("[chatStream] Failed to parse event_unlocked event data:", err, rawData);
      }
      break;
    }

    case "done": {
      try {
        const parsed = JSON.parse(rawData);
        ctx.markDone();
        ctx.onEvent({
          type: "done",
          turnId: String(parsed.turnId || ""),
          messageId: String(parsed.messageId || ""),
          reply: String(parsed.reply ?? ""),
          relationship:
            parsed.relationship && typeof parsed.relationship === "object"
              ? (parsed.relationship as Record<string, unknown>)
              : undefined,
          activeMemories: Array.isArray(parsed.activeMemories)
            ? (parsed.activeMemories as Array<Record<string, unknown>>)
            : undefined,
        });
      } catch (err) {
        console.warn("[chatStream] Failed to parse done event data:", err, rawData);
      }
      break;
    }

    case "error": {
      ctx.markError();
      let statusCode = 500;
      let message = "Đã xảy ra lỗi trong quá trình xử lý.";
      try {
        const parsed = JSON.parse(rawData);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.statusCode === "number") statusCode = parsed.statusCode;
          if (typeof parsed.message === "string") message = parsed.message;
        }
      } catch {
        if (rawData) message = rawData;
      }
      ctx.onEvent({
        type: "error",
        statusCode,
        message,
      });
      ctx.onError?.(new Error(message));
      break;
    }

    default: {
      if (!eventName || eventName === "message") {
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && typeof parsed === "object") {
            if ("delta" in parsed) {
              ctx.onEvent({ type: "token", delta: String(parsed.delta) });
              return;
            }
            if ("turnId" in parsed && "reply" in parsed) {
              ctx.markDone();
              ctx.onEvent({
                type: "done",
                turnId: String(parsed.turnId),
                messageId: String(parsed.messageId || ""),
                reply: String(parsed.reply),
                relationship: parsed.relationship,
                activeMemories: parsed.activeMemories,
              });
              return;
            }
          }
        } catch {
          // Ignore
        }
      }
      break;
    }
  }
}

export async function streamChatMessage(options: StreamChatOptions): Promise<void> {
  const {
    sessionId,
    content,
    signal,
    onEvent,
    onError,
    onComplete,
    baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5010/api/v1",
    fetchFn = fetch,
  } = options;

  if (signal?.aborted) {
    return;
  }

  if (!sessionId || typeof sessionId !== "string") {
    onError?.(new Error("Mã phiên trò chuyện không hợp lệ (sessionId is required)."));
    return;
  }
  if (!content && content !== "") {
    onError?.(new Error("Nội dung tin nhắn không hợp lệ."));
    return;
  }

  const turnId = options.turnId || generateUUID();
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const url = `${cleanBase}/chat/sessions/${encodeURIComponent(sessionId)}/stream`;
  const authHeader = getLocalAuthHeader();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...authHeader,
  };
  const body = JSON.stringify({
    content,
    turnId,
    sessionId,
  });

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers,
      body,
      signal,
    });
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) {
      return;
    }
    const networkError = new Error(
      "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng."
    );
    onError?.(networkError);
    return;
  }

  if (!res.ok) {
    let message = getDefaultErrorMessageForStatus(res.status);
    try {
      const errorJson = await res.json();
      if (errorJson && typeof errorJson === "object") {
        if (typeof errorJson.message === "string") {
          message = errorJson.message;
        } else if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
          message = String(errorJson.errors[0]);
        }
      }
    } catch {
      // JSON parse fallback
    }
    const httpErr = new Error(message);
    (httpErr as unknown as { status?: number }).status = res.status;
    onError?.(httpErr);
    return;
  }

  if (!res.body) {
    const noBodyErr = new Error(
      "Phản hồi máy chủ không chứa luồng dữ liệu (response body is null)."
    );
    onError?.(noBodyErr);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let hasReceivedDone = false;
  let hasStreamError = false;

  const parser = createSseParser({
    onEvent: (rawEvent: SseRawEvent) => {
      try {
        dispatchSseEvent(rawEvent, {
          onEvent,
          onError,
          markDone: () => {
            hasReceivedDone = true;
          },
          markError: () => {
            hasStreamError = true;
          },
        });
      } catch (dispatchErr) {
        console.warn("[chatStream] Error during event dispatch:", dispatchErr);
      }
    },
    onError: (parserErr) => {
      console.warn("[chatStream] SSE parser warning:", parserErr);
    },
  });

  try {
    while (true) {
      if (signal?.aborted || hasStreamError) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (value) {
        const chunkText = decoder.decode(value, { stream: true });
        if (chunkText) {
          parser.feed(chunkText);
        }
      }

      if (hasStreamError) {
        break;
      }
    }

    const remainingText = decoder.decode();
    if (remainingText) {
      parser.feed(remainingText);
    }
    parser.flush();
  } catch (readErr) {
    if (isAbortError(readErr) || signal?.aborted) {
      return;
    }
    const streamErr = new Error(
      "Kết nối luồng bị gián đoạn giữa chừng. Vui lòng thử lại."
    );
    onError?.(streamErr);
    return;
  } finally {
    try {
      if (signal?.aborted || hasStreamError) {
        await reader.cancel().catch(() => {});
      }
    } finally {
      reader.releaseLock();
    }
  }

  if (signal?.aborted || hasStreamError) {
    return;
  }

  if (!hasReceivedDone) {
    const cutoffErr = new Error(
      "Luồng dữ liệu kết thúc bất ngờ trước khi hoàn thành phản hồi."
    );
    onError?.(cutoffErr);
    return;
  }

  onComplete?.();
}
