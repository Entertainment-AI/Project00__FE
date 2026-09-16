/**
 * src/lib/api/sseParser.ts
 *
 * Standalone incremental Server-Sent Events (SSE) line-buffer framing parser.
 * Conforms strictly to W3C / WHATWG SSE specification.
 *
 * Zero external dependencies. Completely decoupled from React/DOM.
 */

export interface SseRawEvent {
  /** Event type name, defaults to 'message' if omitted in wire protocol */
  event: string;
  /** Accumulated data string (with internal newlines preserved if multiline) */
  data: string;
  /** Optional event identifier */
  id?: string;
  /** Optional reconnection retry time in milliseconds */
  retry?: number;
}

export interface SseParserCallbacks {
  /** Invoked whenever a complete SSE event is framed and dispatched */
  onEvent: (event: SseRawEvent) => void;
  /** Invoked if parsing or consumer handling encounters an unhandled error */
  onError?: (error: Error) => void;
}

export interface SseParser {
  /** Ingest an arbitrary string chunk decoded from the network stream */
  feed: (chunk: string) => void;
  /** Flush any remaining buffered line and dispatch pending event on stream EOF */
  flush: () => void;
  /** Reset all internal parser and event buffering state */
  reset: () => void;
}

export type SafeJsonParseResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: Error };

/**
 * Safely parses a JSON string into type T without throwing unhandled exceptions.
 * Useful for stream decoders parsing SseRawEvent.data payloads.
 */
export function safeJsonParse<T = unknown>(text: string): SafeJsonParseResult<T> {
  if (typeof text !== "string" || text.trim().length === 0) {
    return {
      success: false,
      error: new Error("Cannot parse empty or non-string payload as JSON"),
    };
  }
  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

/**
 * Creates an incremental Server-Sent Events (SSE) parser instance.
 */
export function createSseParser(callbacks: SseParserCallbacks): SseParser {
  let buffer = "";
  let eventType = "";
  let dataLines: string[] = [];
  let currentEventId: string | undefined = undefined;
  let lastEventId = "";
  let retryMs: number | undefined = undefined;

  function dispatchCurrentEvent(): void {
    if (dataLines.length === 0 && eventType === "" && currentEventId === undefined) {
      return;
    }

    const event: SseRawEvent = {
      event: eventType || "message",
      data: dataLines.join("\n"),
    };

    const effectiveId = currentEventId !== undefined ? currentEventId : (lastEventId ? lastEventId : undefined);
    if (effectiveId !== undefined) {
      event.id = effectiveId;
    }

    if (retryMs !== undefined) {
      event.retry = retryMs;
    }

    eventType = "";
    dataLines = [];
    currentEventId = undefined;

    try {
      callbacks.onEvent(event);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      callbacks.onError?.(error);
    }
  }

  function processLine(line: string): void {
    if (line.length === 0) {
      dispatchCurrentEvent();
      return;
    }

    if (line.charCodeAt(0) === 0x3a /* ':' */) {
      return;
    }

    const colonIndex = line.indexOf(":");
    let field: string;
    let value: string;

    if (colonIndex === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colonIndex);
      const rawValue = line.slice(colonIndex + 1);
      value = rawValue.charCodeAt(0) === 0x20 /* ' ' */ ? rawValue.slice(1) : rawValue;
    }

    switch (field) {
      case "event":
        eventType = value;
        break;

      case "data":
        dataLines.push(value);
        break;

      case "id":
        if (value.indexOf("\0") === -1) {
          lastEventId = value;
          currentEventId = value;
        }
        break;

      case "retry": {
        if (/^[0-9]+$/.test(value)) {
          const parsedRetry = parseInt(value, 10);
          if (!Number.isNaN(parsedRetry) && parsedRetry >= 0) {
            retryMs = parsedRetry;
          }
        }
        break;
      }

      default:
        break;
    }
  }

  function extractLines(isFlush: boolean): void {
    let lineStart = 0;
    let i = 0;

    while (i < buffer.length) {
      if (!isFlush && i === buffer.length - 1 && buffer.charCodeAt(i) === 0x0d /* '\r' */) {
        break;
      }

      const code = buffer.charCodeAt(i);

      if (code === 0x0d /* '\r' */) {
        const line = buffer.slice(lineStart, i);
        if (i + 1 < buffer.length && buffer.charCodeAt(i + 1) === 0x0a /* '\n' */) {
          i += 2;
        } else {
          i += 1;
        }
        lineStart = i;
        processLine(line);
      } else if (code === 0x0a /* '\n' */) {
        const line = buffer.slice(lineStart, i);
        i += 1;
        lineStart = i;
        processLine(line);
      } else {
        i++;
      }
    }

    if (lineStart > 0) {
      buffer = buffer.slice(lineStart);
    }
  }

  function feed(chunk: string): void {
    if (!chunk) return;
    buffer += chunk;
    extractLines(false);
  }

  function flush(): void {
    extractLines(true);

    if (buffer.length > 0) {
      const remainingLine = buffer;
      buffer = "";
      processLine(remainingLine);
    }

    dispatchCurrentEvent();
  }

  function reset(): void {
    buffer = "";
    eventType = "";
    dataLines = [];
    currentEventId = undefined;
    lastEventId = "";
    retryMs = undefined;
  }

  return {
    feed,
    flush,
    reset,
  };
}
