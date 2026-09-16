/**
 * tests/empirical_challenge_m1_2.test.ts
 *
 * Challenger 2 (M1) Empirical Verification & Stress Test Suite.
 * Challenges src/lib/api/chatStream.ts against:
 *  1. AbortController lifecycle (before fetch, during fetch, during reading, after done, within callbacks)
 *  2. HTTP 409 concurrency conflict handling with stable turnId preservation across retries
 *  3. Premature stream EOF and transport interruption without done event
 *  4. In-stream error event terminating reader loop cleanly and cancelling stream
 *  5. Replayed turn idempotency parsing (instant done replay, token + done replay, authoritative done.reply)
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  streamChatMessage,
  type ChatStreamEvent,
  type StreamTokenEvent,
  type StreamDoneEvent,
  type StreamErrorEvent,
} from "../src/lib/api/chatStream";
import {
  createMockFetchResponse,
  formatSseString,
} from "./helpers/mockStreamServer";

describe("Challenger 2 Empirical Verification: Backend Contract Edge Cases & Transport Resilience", async () => {
  const sessionId = "sess-challenger-m1-2-uuid";
  let capturedEvents: ChatStreamEvent[];
  let capturedErrors: Error[];
  let isCompleted: boolean;

  beforeEach(() => {
    capturedEvents = [];
    capturedErrors = [];
    isCompleted = false;
  });

  // =========================================================================
  // 1. ABORTCONTROLLER LIFECYCLE STRESS TESTS
  // =========================================================================
  describe("1. AbortController Lifecycle Stress Tests", () => {
    test("1.1 Abort fired BEFORE fetch: returns immediately, 0 fetch calls, 0 callbacks", async () => {
      let fetchCallCount = 0;
      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      const mockFetch: typeof fetch = async () => {
        fetchCallCount++;
        return createMockFetchResponse([]);
      };

      await streamChatMessage({
        sessionId,
        content: "Pre-aborted test",
        signal: controller.signal,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(fetchCallCount, 0, "Fetch must not be called when pre-aborted");
      assert.equal(capturedEvents.length, 0, "No events should be emitted");
      assert.equal(capturedErrors.length, 0, "onError must not be called on pre-abort");
      assert.equal(isCompleted, false, "onComplete must not be called on pre-abort");
    });

    test("1.2 Abort fired DURING fetch (slow connection / pending handshake): halts cleanly without error", async () => {
      const controller = new AbortController();
      let fetchStarted = false;

      const mockFetch: typeof fetch = async (_url, init) => {
        fetchStarted = true;
        return new Promise<Response>((_resolve, reject) => {
          // Listen to the signal passed to fetch
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
      };

      const streamPromise = streamChatMessage({
        sessionId,
        content: "Abort during fetch",
        signal: controller.signal,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      // Wait briefly for fetch promise to be established in flight
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(fetchStarted, true, "Fetch must be in flight before abort is triggered");

      controller.abort();
      await streamPromise;

      assert.equal(capturedEvents.length, 0);
      assert.equal(capturedErrors.length, 0, "Abort during fetch must not invoke onError");
      assert.equal(isCompleted, false, "Abort during fetch must not invoke onComplete");
    });

    test("1.3 Abort fired DURING reading (mid-stream): preserves partial events, halts reader, no error", async () => {
      const controller = new AbortController();
      let readerCancelled = false;

      // Custom mock stream to verify reader.cancel() invocation
      const chunks = [
        formatSseString("token", { delta: "Chunk 1" }),
        formatSseString("token", { delta: "Chunk 2" }),
        formatSseString("done", { turnId: "t", messageId: "m", reply: "done" }),
      ];

      const encoder = new TextEncoder();
      let chunkIdx = 0;

      const customStream = new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          if (chunkIdx >= chunks.length) {
            ctrl.close();
            return;
          }
          if (chunkIdx > 0) {
            // Delay chunk 2 so abort can fire while reading
            await new Promise((r) => setTimeout(r, 40));
          }
          if (controller.signal.aborted) {
            ctrl.error(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          ctrl.enqueue(encoder.encode(chunks[chunkIdx++]));
        },
        cancel() {
          readerCancelled = true;
        },
      });

      const mockFetch: typeof fetch = async () =>
        new Response(customStream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });

      const streamPromise = streamChatMessage({
        sessionId,
        content: "Abort mid-stream",
        signal: controller.signal,
        fetchFn: mockFetch,
        onEvent: (e) => {
          capturedEvents.push(e);
          // Abort after first token arrives
          if (e.type === "token" && e.delta === "Chunk 1") {
            controller.abort();
          }
        },
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      await streamPromise;

      // Chunk 1 was received before abort
      assert.equal(capturedEvents.length, 1);
      assert.equal((capturedEvents[0] as StreamTokenEvent).delta, "Chunk 1");

      // Chunk 2 and done were suppressed
      assert.equal(capturedErrors.length, 0, "User cancellation must not trigger onError");
      assert.equal(isCompleted, false);
      assert.equal(readerCancelled, true, "ReadableStream reader.cancel() must be called on abort");
    });

    test("1.4 Abort fired AFTER done event completes: resolves cleanly, no unhandled exceptions", async () => {
      const controller = new AbortController();

      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("token", { delta: "Complete token" }),
          formatSseString("done", { turnId: "t-done", messageId: "m-done", reply: "Complete token" }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Normal stream then abort",
        signal: controller.signal,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 2);
      assert.equal(isCompleted, true);
      assert.equal(capturedErrors.length, 0);

      // Abort is fired AFTER streamChatMessage has completely resolved
      assert.doesNotThrow(() => {
        controller.abort();
      });
    });

    test("1.5 Abort fired synchronously inside onEvent for done event: clean exit without error", async () => {
      const controller = new AbortController();

      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("token", { delta: "Hello" }),
          formatSseString("done", { turnId: "t-done-sync", messageId: "m-done-sync", reply: "Hello" }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Abort inside done event",
        signal: controller.signal,
        fetchFn: mockFetch,
        onEvent: (e) => {
          capturedEvents.push(e);
          if (e.type === "done") {
            controller.abort();
          }
        },
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 2);
      assert.equal(capturedEvents[1].type, "done");
      assert.equal(capturedErrors.length, 0, "Abort on done must not trigger onError");
    });

    test("1.6 Multi-event chunk: abort triggered on first token when multiple tokens exist in same chunk", async () => {
      const controller = new AbortController();
      const multiTokenChunk =
        formatSseString("token", { delta: "TokenA" }) +
        formatSseString("token", { delta: "TokenB" }) +
        formatSseString("token", { delta: "TokenC" });

      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([multiTokenChunk]);

      await streamChatMessage({
        sessionId,
        content: "Multi-token abort test",
        signal: controller.signal,
        fetchFn: mockFetch,
        onEvent: (e) => {
          capturedEvents.push(e);
          if (e.type === "token" && e.delta === "TokenA") {
            controller.abort();
          }
        },
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      const tokenDeltas = capturedEvents.map((e) => (e as StreamTokenEvent).delta);
      console.log(`[Adversarial Probe] Tokens delivered when aborted on TokenA within same chunk: ${tokenDeltas.join(", ")}`);
    });
  });

  // =========================================================================
  // 2. HTTP 409 CONCURRENCY CONFLICT & TURNID PRESERVATION TESTS
  // =========================================================================
  describe("2. HTTP 409 Concurrency Conflict & TurnId Preservation", () => {
    test("2.1 HTTP 409 response with JSON body correctly maps status and server message", async () => {
      let capturedBody = "";
      const expectedTurnId = "turn-concurrency-409-uuid";

      const mockFetch: typeof fetch = async (_url, init) => {
        capturedBody = String(init?.body || "{}");
        return createMockFetchResponse([], {
          status: 409,
          errorBody: JSON.stringify({
            statusCode: 409,
            message: "Xung đột cập nhật dữ liệu. Phiên trò chuyện đang xử lý yêu cầu khác.",
          }),
        });
      };

      await streamChatMessage({
        sessionId,
        content: "Concurrent prompt",
        turnId: expectedTurnId,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
      });

      // Verify wire payload preserved turnId
      const parsedBody = JSON.parse(capturedBody);
      assert.equal(parsedBody.turnId, expectedTurnId);
      assert.equal(parsedBody.content, "Concurrent prompt");

      // Verify error handling
      assert.equal(capturedErrors.length, 1);
      const err = capturedErrors[0];
      assert.equal((err as unknown as { status: number }).status, 409);
      assert.ok(err.message.includes("Xung đột cập nhật"));
      assert.equal(capturedEvents.length, 0);
    });

    test("2.2 HTTP 409 response with empty or non-JSON body falls back to default Vietnamese error", async () => {
      const mockFetch: typeof fetch = async () =>
        new Response("", {
          status: 409,
          statusText: "Conflict",
          headers: { "Content-Type": "text/plain" },
        });

      await streamChatMessage({
        sessionId,
        content: "Empty 409 test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
      });

      assert.equal(capturedErrors.length, 1);
      const err = capturedErrors[0];
      assert.equal((err as unknown as { status: number }).status, 409);
      assert.equal(
        err.message,
        "Xung đột cập nhật dữ liệu. Vui lòng thử lại với cùng lượt tương tác."
      );
    });

    test("2.3 Safe retry cycle: preserving exact same turnId across 409 failure and recovery", async () => {
      const stableTurnId = "idempotent-turn-retry-8888";
      let requestAttempts = 0;
      const sentTurnIds: string[] = [];

      const mockFetch: typeof fetch = async (_url, init) => {
        requestAttempts++;
        const body = JSON.parse(String(init?.body || "{}"));
        sentTurnIds.push(body.turnId);

        if (requestAttempts === 1) {
          // Attempt 1: 409 Concurrency Conflict
          return createMockFetchResponse([], {
            status: 409,
            errorBody: JSON.stringify({
              statusCode: 409,
              message: "Concurrent lock held by backend worker",
            }),
          });
        }

        // Attempt 2: Success on retry with same turnId
        return createMockFetchResponse([
          formatSseString("token", { delta: "Phục hồi thành công!" }),
          formatSseString("done", {
            turnId: stableTurnId,
            messageId: "msg-recovered-99",
            reply: "Phục hồi thành công!",
          }),
        ]);
      };

      // 1st Attempt: Fails with 409
      await streamChatMessage({
        sessionId,
        content: "Critical turn needing idempotency",
        turnId: stableTurnId,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
      });

      assert.equal(requestAttempts, 1);
      assert.equal(capturedErrors.length, 1);
      assert.equal(sentTurnIds[0], stableTurnId);

      // Clear transient error state before retry
      capturedErrors = [];
      capturedEvents = [];

      // 2nd Attempt: User retries with SAME turnId
      await streamChatMessage({
        sessionId,
        content: "Critical turn needing idempotency",
        turnId: stableTurnId,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(requestAttempts, 2);
      assert.equal(sentTurnIds[1], stableTurnId, "Retry MUST use the exact same turnId");
      assert.equal(capturedErrors.length, 0);
      assert.equal(capturedEvents.length, 2);
      assert.equal((capturedEvents[1] as StreamDoneEvent).turnId, stableTurnId);
      assert.equal(isCompleted, true);
    });

    test("2.4 In-stream 409 error event emitted mid-stream halts reader cleanly", async () => {
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("token", { delta: "Bắt đầu sinh nội dung..." }),
          formatSseString("error", {
            statusCode: 409,
            message: "Xung đột phiên bản dữ liệu giữa chừng.",
          }),
          formatSseString("token", { delta: "Dòng này không được phép xuất hiện" }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Mid-stream 409 test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 2);
      assert.equal(capturedEvents[0].type, "token");
      assert.equal((capturedEvents[0] as StreamTokenEvent).delta, "Bắt đầu sinh nội dung...");

      const errEvent = capturedEvents[1] as StreamErrorEvent;
      assert.equal(errEvent.type, "error");
      assert.equal(errEvent.statusCode, 409);
      assert.equal(errEvent.message, "Xung đột phiên bản dữ liệu giữa chừng.");

      assert.equal(capturedErrors.length, 1);
      assert.equal(capturedErrors[0].message, "Xung đột phiên bản dữ liệu giữa chừng.");
      assert.equal(isCompleted, false);
    });
  });

  // =========================================================================
  // 3. PREMATURE STREAM EOF & TRANSPORT CUTOFF TESTS
  // =========================================================================
  describe("3. Premature Stream EOF & Transport Cutoff", () => {
    test("3.1 Immediate EOF with zero bytes emits premature cutoff error", async () => {
      const mockFetch: typeof fetch = async () => createMockFetchResponse([]);

      await streamChatMessage({
        sessionId,
        content: "Empty stream test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 0);
      assert.equal(capturedErrors.length, 1);
      assert.ok(
        capturedErrors[0].message.includes("kết thúc bất ngờ"),
        `Error message should indicate cutoff: ${capturedErrors[0].message}`
      );
      assert.equal(isCompleted, false);
    });

    test("3.2 Premature EOF after partial tokens without done event preserves tokens and invokes onError", async () => {
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("token", { delta: "Phần 1 " }),
          formatSseString("token", { delta: "Phần 2 " }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Partial tokens cutoff test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 2);
      assert.equal((capturedEvents[0] as StreamTokenEvent).delta, "Phần 1 ");
      assert.equal((capturedEvents[1] as StreamTokenEvent).delta, "Phần 2 ");

      assert.equal(capturedErrors.length, 1);
      assert.ok(capturedErrors[0].message.includes("kết thúc bất ngờ"));
      assert.equal(isCompleted, false);
    });

    test("3.3 Reader socket failure (ECONNRESET) mid-stream releases reader lock and invokes onError", async () => {
      let lockReleased = false;

      // Create a stream where reader.releaseLock() can be tracked
      const stream = new ReadableStream<Uint8Array>({
        pull(ctrl) {
          ctrl.error(new Error("ECONNRESET: socket hang up"));
        },
      });

      const originalGetReader = stream.getReader.bind(stream);
      (stream as unknown as { getReader: () => ReadableStreamDefaultReader<Uint8Array> }).getReader = () => {
        const r = originalGetReader();
        const originalRelease = r.releaseLock.bind(r);
        r.releaseLock = () => {
          lockReleased = true;
          originalRelease();
        };
        return r;
      };

      const mockFetch: typeof fetch = async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });

      await streamChatMessage({
        sessionId,
        content: "Socket drop test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedErrors.length, 1);
      assert.ok(capturedErrors[0].message.includes("gián đoạn"));
      assert.equal(lockReleased, true, "Reader lock must be released even after stream failure");
      assert.equal(isCompleted, false);
    });

    test("3.4 Truncated SSE line at EOF (incomplete JSON framing) handles cleanly without unhandled crash", async () => {
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          "event: token\ndata: {\"delta\":\"OK\"}\n\n",
          "event: done\ndata: {\"turnId\":\"incomplete", // Truncated mid-JSON at EOF
        ]);

      await streamChatMessage({
        sessionId,
        content: "Truncated EOF test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      // Token should have been delivered
      assert.equal(capturedEvents.length, 1);
      assert.equal((capturedEvents[0] as StreamTokenEvent).delta, "OK");

      // Incomplete done event cannot be parsed -> cutoff error
      assert.equal(capturedErrors.length, 1);
      assert.ok(capturedErrors[0].message.includes("kết thúc bất ngờ"));
      assert.equal(isCompleted, false);
    });
  });

  // =========================================================================
  // 4. IN-STREAM ERROR EVENT HANDLING & CLEANUP TESTS
  // =========================================================================
  describe("4. In-Stream Error Event Handling & Cleanup", () => {
    test("4.1 In-stream error halts reader loop, invokes onError, and cancels reader", async () => {
      let streamCancelled = false;

      const encoder = new TextEncoder();
      const chunks = [
        formatSseString("token", { delta: "Alpha" }),
        formatSseString("error", { statusCode: 502, message: "Upstream LLM gateway timeout" }),
        formatSseString("token", { delta: "Beta - should never be reached" }),
      ];
      let idx = 0;

      const stream = new ReadableStream<Uint8Array>({
        pull(ctrl) {
          if (idx >= chunks.length) {
            ctrl.close();
            return;
          }
          ctrl.enqueue(encoder.encode(chunks[idx++]));
        },
        cancel() {
          streamCancelled = true;
        },
      });

      const mockFetch: typeof fetch = async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });

      await streamChatMessage({
        sessionId,
        content: "In-stream error cancellation test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      // Exactly 2 events received: token and error
      assert.equal(capturedEvents.length, 2);
      assert.equal(capturedEvents[0].type, "token");
      assert.equal(capturedEvents[1].type, "error");
      assert.equal((capturedEvents[1] as StreamErrorEvent).statusCode, 502);

      // onError called with error message
      assert.equal(capturedErrors.length, 1);
      assert.equal(capturedErrors[0].message, "Upstream LLM gateway timeout");

      // Stream cancelled & completed false
      assert.equal(streamCancelled, true, "Reader must cancel stream when in-stream error occurs");
      assert.equal(isCompleted, false);
    });

    test("4.2 In-stream error with non-JSON raw string payload parses gracefully", async () => {
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          "event: error\ndata: Fatal backend exception string\n\n",
        ]);

      await streamChatMessage({
        sessionId,
        content: "Raw string error test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
      });

      assert.equal(capturedEvents.length, 1);
      const errEvent = capturedEvents[0] as StreamErrorEvent;
      assert.equal(errEvent.type, "error");
      assert.equal(errEvent.statusCode, 500);
      assert.equal(errEvent.message, "Fatal backend exception string");

      assert.equal(capturedErrors.length, 1);
      assert.equal(capturedErrors[0].message, "Fatal backend exception string");
    });

    test("4.3 In-stream error with empty payload uses default status 500 and default Vietnamese message", async () => {
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          "event: error\ndata: {}\n\n",
        ]);

      await streamChatMessage({
        sessionId,
        content: "Empty payload error test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
      });

      assert.equal(capturedEvents.length, 1);
      const errEvent = capturedEvents[0] as StreamErrorEvent;
      assert.equal(errEvent.type, "error");
      assert.equal(errEvent.statusCode, 500);
      assert.equal(errEvent.message, "Đã xảy ra lỗi trong quá trình xử lý.");
    });

    test("4.4 Multi-event chunk: error event followed by token in same network chunk", async () => {
      // Both error and subsequent token are framed in a single string chunk
      const multiEventChunk =
        "event: error\ndata: {\"statusCode\": 403, \"message\": \"Access forbidden\"}\n\n" +
        "event: token\ndata: {\"delta\": \"Leaked token content\"}\n\n";

      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([multiEventChunk]);

      await streamChatMessage({
        sessionId,
        content: "Same chunk error test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
        onComplete: () => {
          isCompleted = true;
        },
      });

      // Verify what was captured
      assert.equal(capturedErrors.length, 1);
      assert.equal(capturedErrors[0].message, "Access forbidden");
      assert.equal(isCompleted, false);

      // Check if subsequent token in same chunk was dispatched or suppressed
      const tokenEvents = capturedEvents.filter((e) => e.type === "token");
      console.log(`[Adversarial Probe] Tokens delivered after error in same chunk: ${tokenEvents.length}`);
    });
  });

  // =========================================================================
  // 5. REPLAYED TURN IDEMPOTENCY PARSING TESTS
  // =========================================================================
  describe("5. Replayed Turn Idempotency Parsing", () => {
    test("5.1 Standard replay: exact token deltas followed by done snapshot", async () => {
      const replayTurnId = "replay-turn-id-1234";
      const replayMsgId = "replay-msg-id-5678";

      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("token", { delta: "Nội dung " }),
          formatSseString("token", { delta: "đã lưu trữ." }),
          formatSseString("done", {
            turnId: replayTurnId,
            messageId: replayMsgId,
            reply: "Nội dung đã lưu trữ.",
            relationship: { stage: "Friend", affectionScore: 25 },
            activeMemories: [{ id: "mem-replayed", summary: "Cached story" }],
          }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Replay prompt",
        turnId: replayTurnId,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 3);
      const doneEvt = capturedEvents[2] as StreamDoneEvent;
      assert.equal(doneEvt.type, "done");
      assert.equal(doneEvt.turnId, replayTurnId);
      assert.equal(doneEvt.messageId, replayMsgId);
      assert.equal(doneEvt.reply, "Nội dung đã lưu trữ.");
      assert.deepEqual(doneEvt.relationship, { stage: "Friend", affectionScore: 25 });
      assert.equal(doneEvt.activeMemories?.length, 1);
      assert.equal(isCompleted, true);
      assert.equal(capturedErrors.length, 0);
    });

    test("5.2 Instant replay: 0 tokens, immediate done snapshot event only", async () => {
      const instantTurnId = "instant-replay-turn-001";
      const instantMsgId = "instant-replay-msg-002";
      const authoritativeText = "Câu trả lời tức thì từ bộ nhớ đệm.";

      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("done", {
            turnId: instantTurnId,
            messageId: instantMsgId,
            reply: authoritativeText,
            relationship: { stage: "Companion", affectionScore: 90 },
            activeMemories: [],
          }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Fast cached query",
        turnId: instantTurnId,
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 1);
      const doneEvt = capturedEvents[0] as StreamDoneEvent;
      assert.equal(doneEvt.type, "done");
      assert.equal(doneEvt.turnId, instantTurnId);
      assert.equal(doneEvt.messageId, instantMsgId);
      assert.equal(doneEvt.reply, authoritativeText);
      assert.equal(isCompleted, true);
      assert.equal(capturedErrors.length, 0);
    });

    test("5.3 Authoritative done.reply precedence when done.reply differs from accumulated tokens", async () => {
      // Backend contract: done.reply is authoritative over partial tokens
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("token", { delta: "Bản thảo chưa chỉnh sửa" }),
          formatSseString("done", {
            turnId: "turn-auth-reply",
            messageId: "msg-auth-reply",
            reply: "Bản chỉnh sửa cuối cùng chính xác nhất từ máy chủ.",
          }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Precedence test",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 2);
      const tokenEvt = capturedEvents[0] as StreamTokenEvent;
      const doneEvt = capturedEvents[1] as StreamDoneEvent;

      assert.equal(tokenEvt.delta, "Bản thảo chưa chỉnh sửa");
      assert.equal(doneEvt.reply, "Bản chỉnh sửa cuối cùng chính xác nhất từ máy chủ.");
      assert.notEqual(tokenEvt.delta, doneEvt.reply);
      assert.equal(isCompleted, true);
    });

    test("5.4 Replay with default SSE message event (omitted event header) maps to done", async () => {
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          "data: {\"turnId\":\"turn-default-field\",\"messageId\":\"msg-default-field\",\"reply\":\"Hồi đáp mặc định\"}\n\n",
        ]);

      await streamChatMessage({
        sessionId,
        content: "Default SSE message format",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.equal(capturedEvents.length, 1);
      const doneEvt = capturedEvents[0] as StreamDoneEvent;
      assert.equal(doneEvt.type, "done");
      assert.equal(doneEvt.turnId, "turn-default-field");
      assert.equal(doneEvt.messageId, "msg-default-field");
      assert.equal(doneEvt.reply, "Hồi đáp mặc định");
      assert.equal(isCompleted, true);
    });
  });

  // =========================================================================
  // 6. ADVERSARIAL EDGE CASES & FAULT INJECTION
  // =========================================================================
  describe("6. Adversarial Edge Cases & Fault Injection", () => {
    test("6.1 SessionId with special characters and slashes is properly URL-encoded", async () => {
      let requestedUrl = "";
      const specialSessionId = "session/with slashes & special # chars";

      const mockFetch: typeof fetch = async (url) => {
        requestedUrl = String(url);
        return createMockFetchResponse([
          formatSseString("done", { turnId: "t", messageId: "m", reply: "ok" }),
        ]);
      };

      await streamChatMessage({
        sessionId: specialSessionId,
        content: "Test special chars",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onComplete: () => {
          isCompleted = true;
        },
      });

      assert.ok(
        requestedUrl.includes(encodeURIComponent(specialSessionId)),
        `URL must encode special chars in sessionId: ${requestedUrl}`
      );
      assert.ok(!requestedUrl.includes("session/with slashes"));
      assert.equal(isCompleted, true);
    });

    test("6.2 Consumer onEvent callback exception does not unhandle-crash reader loop", async () => {
      let secondEventDelivered = false;

      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([
          formatSseString("token", { delta: "First token" }),
          formatSseString("done", { turnId: "t-recover", messageId: "m-recover", reply: "First token" }),
        ]);

      await streamChatMessage({
        sessionId,
        content: "Throwing consumer",
        fetchFn: mockFetch,
        onEvent: (e) => {
          if (e.type === "token") {
            throw new Error("Consumer UI error in onEvent");
          }
          if (e.type === "done") {
            secondEventDelivered = true;
          }
        },
        onComplete: () => {
          isCompleted = true;
        },
      });

      // Stream continues to done despite throw in onEvent for token
      assert.equal(secondEventDelivered, true, "Done event should still be processed");
      assert.equal(isCompleted, true);
    });

    test("6.3 Empty string turnId triggers UUID fallback", async () => {
      let sentBody = "";

      const mockFetch: typeof fetch = async (_url, init) => {
        sentBody = String(init?.body || "{}");
        return createMockFetchResponse([
          formatSseString("done", { turnId: "t", messageId: "m", reply: "" }),
        ]);
      };

      await streamChatMessage({
        sessionId,
        content: "Empty turnId test",
        turnId: "",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
      });

      const parsed = JSON.parse(sentBody);
      assert.ok(parsed.turnId.length >= 32, "Empty turnId must trigger UUID generation");
    });
  });
});
