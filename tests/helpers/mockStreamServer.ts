/**
 * tests/helpers/mockStreamServer.ts
 *
 * Mock stream generators and network mock helpers for SSE transport and E2E testing.
 */

export interface MockStreamOptions {
  delayMs?: number;
  throwAtChunkIndex?: number;
  throwError?: Error;
  abortSignal?: AbortSignal;
}

/**
 * Encodes text chunks into a ReadableStream<Uint8Array> with controllable chunk boundaries,
 * delays, and mid-stream errors.
 */
export function createMockSseStream(
  chunks: string[],
  options: MockStreamOptions = {}
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (options.abortSignal?.aborted) {
        controller.error(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }

      if (options.throwAtChunkIndex !== undefined && chunkIndex === options.throwAtChunkIndex) {
        controller.error(options.throwError || new Error("Network stream abruptly closed"));
        return;
      }

      if (chunkIndex >= chunks.length) {
        controller.close();
        return;
      }

      if (options.delayMs && options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }

      const chunk = chunks[chunkIndex++];
      controller.enqueue(encoder.encode(chunk));
    },
    cancel() {
      // Reader cancelled
    },
  });
}

/**
 * Creates a mock Fetch Response object backed by an SSE ReadableStream or error status.
 */
export function createMockFetchResponse(
  chunks: string[],
  init: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    streamOptions?: MockStreamOptions;
    errorBody?: string;
  } = {}
): Response {
  const status = init.status ?? 200;
  const statusText = init.statusText ?? (status === 200 ? "OK" : "Error");
  const headers = new Headers({
    "Content-Type": status === 200 ? "text/event-stream" : "application/json",
    ...(init.headers || {}),
  });

  if (status >= 400) {
    const errorText = init.errorBody || JSON.stringify({
      statusCode: status,
      message: `HTTP ${status} error`,
    });
    return new Response(errorText, {
      status,
      statusText,
      headers,
    });
  }

  const stream = createMockSseStream(chunks, init.streamOptions);
  return new Response(stream, {
    status,
    statusText,
    headers,
  });
}

/**
 * Serializes typed event into SSE wire protocol format matching Project00 BE:
 * `event: <name>\ndata: <json>\n\n`
 */
export function formatSseString(event: string, data: unknown, id?: string): string {
  const dataStr = typeof data === "string" ? data : JSON.stringify(data);
  let sse = `event: ${event}\n`;
  if (id) {
    sse += `id: ${id}\n`;
  }
  sse += `data: ${dataStr}\n\n`;
  return sse;
}
