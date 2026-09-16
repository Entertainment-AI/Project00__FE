/**
 * src/lib/api/__tests__/chatStream.test.ts
 *
 * Comprehensive Tier 1 (Coverage), Tier 2 (Boundary), and Tier 3 (Cross-Feature)
 * test suite for the Streaming Transport Client (`streamChatMessage`).
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getChatStream } from "../../../../tests/helpers/loadModule";
import {
  createMockFetchResponse,
  formatSseString,
} from "../../../../tests/helpers/mockStreamServer";
import type {
  ChatStreamEvent,
  StreamTokenEvent,
  StreamMetadataEvent,
  StreamEventUnlockedEvent,
  StreamDoneEvent,
  StreamErrorEvent,
} from "@/lib/api/chatStream";

describe("Streaming Transport Client (Tiers 1, 2, 3)", async () => {
  const { streamChatMessage } = await getChatStream();

  const sessionId = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
  let capturedEvents: ChatStreamEvent[];
  let capturedErrors: Error[];
  let isCompleted: boolean;

  beforeEach(() => {
    capturedEvents = [];
    capturedErrors = [];
    isCompleted = false;
  });

  // ==========================================
  // TIER 1: CORE TRANSPORT & ROUTING TESTS
  // ==========================================

  test("T1.1: Correct POST method, URL, and JSON content-type headers", async () => {
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedOptions = init;
      const sseBody = [
        formatSseString("token", { delta: "ok" }),
        formatSseString("done", {
          turnId: "t1",
          messageId: "m1",
          reply: "ok",
        }),
      ];
      return createMockFetchResponse(sseBody);
    };

    await streamChatMessage({
      sessionId,
      content: "Hello AI",
      baseUrl: "http://localhost:5010/api/v1",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
      onComplete: () => {
        isCompleted = true;
      },
    });

    assert.equal(
      capturedUrl,
      `http://localhost:5010/api/v1/chat/sessions/${sessionId}/stream`
    );
    assert.equal(capturedOptions?.method, "POST");

    const headers = capturedOptions?.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(headers["Accept"], "text/event-stream");
    assert.equal(isCompleted, true);
  });

  test("T1.2: Authorization Bearer header attachment when token is in localStorage", async () => {
    let capturedHeaders: Record<string, string> = {};

    // Mock localStorage
    const originalLocalStorage = globalThis.localStorage;
    const originalWindow = globalThis.window;

    try {
      (globalThis as unknown as { window: unknown }).window = globalThis;
      globalThis.localStorage = {
        getItem: (key: string) =>
          key === "nyxoris_auth_token" ? "mock-jwt-bearer-xyz" : null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        length: 1,
        key: () => null,
      };

      const mockFetch: typeof fetch = async (_, init) => {
        capturedHeaders = (init?.headers || {}) as Record<string, string>;
        return createMockFetchResponse([
          formatSseString("done", { turnId: "t", messageId: "m", reply: "done" }),
        ]);
      };

      await streamChatMessage({
        sessionId,
        content: "Test auth",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
      });

      assert.equal(capturedHeaders["Authorization"], "Bearer mock-jwt-bearer-xyz");
    } finally {
      globalThis.localStorage = originalLocalStorage;
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  });

  test("T1.3: Request body includes content and user-provided turnId", async () => {
    let capturedBody = "";

    const mockFetch: typeof fetch = async (_, init) => {
      capturedBody = String(init?.body || "");
      return createMockFetchResponse([
        formatSseString("done", { turnId: "custom-turn-123", messageId: "m1", reply: "" }),
      ]);
    };

    await streamChatMessage({
      sessionId,
      content: "Custom turn message",
      turnId: "custom-turn-123",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
    });

    const parsed = JSON.parse(capturedBody);
    assert.equal(parsed.content, "Custom turn message");
    assert.equal(parsed.turnId, "custom-turn-123");
    assert.equal(parsed.sessionId, sessionId);
  });

  test("T1.4: Client generates a valid UUID v4 turnId when turnId is omitted", async () => {
    let capturedBody = "";

    const mockFetch: typeof fetch = async (_, init) => {
      capturedBody = String(init?.body || "");
      return createMockFetchResponse([
        formatSseString("done", { turnId: "t-gen", messageId: "m-gen", reply: "" }),
      ]);
    };

    await streamChatMessage({
      sessionId,
      content: "Auto UUID message",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
    });

    const parsed = JSON.parse(capturedBody);
    assert.ok(typeof parsed.turnId === "string" && parsed.turnId.length >= 32);
    // Standard UUID format check: 8-4-4-4-12
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert.match(parsed.turnId, uuidRegex);
  });

  test("T1.5: Typed event routing: token, metadata, event_unlocked, done", async () => {
    const sseChunks = [
      formatSseString("token", { delta: "Xin " }),
      formatSseString("token", { delta: "chào!" }),
      formatSseString("metadata", {
        mood: "Joyful",
        intensity: 90,
        affectionDelta: 5,
        affectionScore: 35,
        relationshipStage: "CloseFriend",
        characterId: "char-123",
        userId: "user-456",
      }),
      formatSseString("event_unlocked", {
        eventKey: "first_laugh",
        context: "Laughed at joke",
      }),
      formatSseString("done", {
        turnId: "t-100",
        messageId: "m-200",
        reply: "Xin chào!",
        relationship: { stage: "CloseFriend", affectionScore: 35 },
        activeMemories: [{ id: "mem-1", summary: "Shared laughter" }],
      }),
    ];

    const mockFetch: typeof fetch = async () => createMockFetchResponse(sseChunks);

    await streamChatMessage({
      sessionId,
      content: "Greeting",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
      onComplete: () => {
        isCompleted = true;
      },
    });

    assert.equal(capturedEvents.length, 5);

    // Event 1: token
    const e1 = capturedEvents[0] as StreamTokenEvent;
    assert.equal(e1.type, "token");
    assert.equal(e1.delta, "Xin ");

    // Event 2: token
    const e2 = capturedEvents[1] as StreamTokenEvent;
    assert.equal(e2.type, "token");
    assert.equal(e2.delta, "chào!");

    // Event 3: metadata
    const e3 = capturedEvents[2] as StreamMetadataEvent;
    assert.equal(e3.type, "metadata");
    assert.equal(e3.mood, "Joyful");
    assert.equal(e3.intensity, 90);
    assert.equal(e3.affectionDelta, 5);
    assert.equal(e3.affectionScore, 35);
    assert.equal(e3.relationshipStage, "CloseFriend");
    assert.equal(e3.characterId, "char-123");
    assert.equal(e3.userId, "user-456");

    // Event 4: event_unlocked
    const e4 = capturedEvents[3] as StreamEventUnlockedEvent;
    assert.equal(e4.type, "event_unlocked");
    assert.equal(e4.eventKey, "first_laugh");
    assert.equal(e4.context, "Laughed at joke");

    // Event 5: done
    const e5 = capturedEvents[4] as StreamDoneEvent;
    assert.equal(e5.type, "done");
    assert.equal(e5.turnId, "t-100");
    assert.equal(e5.messageId, "m-200");
    assert.equal(e5.reply, "Xin chào!");
    assert.deepEqual(e5.relationship, { stage: "CloseFriend", affectionScore: 35 });
    assert.equal(e5.activeMemories?.length, 1);

    assert.equal(isCompleted, true);
  });

  // ==========================================
  // TIER 2: ERROR HANDLING & BOUNDARY TESTS
  // ==========================================

  const errorStatusCases = [
    { status: 400, name: "400 Bad Request" },
    { status: 401, name: "401 Unauthorized" },
    { status: 403, name: "403 Forbidden" },
    { status: 404, name: "404 Not Found" },
    { status: 409, name: "409 Conflict" },
    { status: 429, name: "429 Too Many Requests" },
    { status: 500, name: "500 Internal Server Error" },
  ];

  for (const { status, name } of errorStatusCases) {
    test(`T2.1: HTTP status error handling for ${name}`, async () => {
      const mockFetch: typeof fetch = async () =>
        createMockFetchResponse([], {
          status,
          errorBody: JSON.stringify({
            statusCode: status,
            message: `Server returned ${status}`,
          }),
        });

      await streamChatMessage({
        sessionId,
        content: "Error trigger",
        fetchFn: mockFetch,
        onEvent: (e) => capturedEvents.push(e),
        onError: (err) => capturedErrors.push(err),
      });

      assert.equal(capturedErrors.length, 1);
      assert.equal(capturedEvents.length, 0);
      assert.ok(capturedErrors[0].message.length > 0);
      assert.equal((capturedErrors[0] as unknown as { status: number }).status, status);
    });
  }

  test("T2.2: In-stream error event handling terminates stream and invokes onError", async () => {
    const sseChunks = [
      formatSseString("token", { delta: "Starting response..." }),
      formatSseString("error", {
        statusCode: 409,
        message: "Optimistic concurrency conflict on streaming turn",
      }),
      formatSseString("token", { delta: "This should be ignored" }),
    ];

    const mockFetch: typeof fetch = async () => createMockFetchResponse(sseChunks);

    await streamChatMessage({
      sessionId,
      content: "Concurrency collision",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
      onError: (err) => capturedErrors.push(err),
      onComplete: () => {
        isCompleted = true;
      },
    });

    // Should receive first token, then error event
    assert.equal(capturedEvents.length, 2);
    assert.equal(capturedEvents[0].type, "token");

    const errEvent = capturedEvents[1] as StreamErrorEvent;
    assert.equal(errEvent.type, "error");
    assert.equal(errEvent.statusCode, 409);
    assert.equal(errEvent.message, "Optimistic concurrency conflict on streaming turn");

    // onError should be called with the error message
    assert.equal(capturedErrors.length, 1);
    assert.equal(capturedErrors[0].message, "Optimistic concurrency conflict on streaming turn");

    // onComplete should NOT be called after an error
    assert.equal(isCompleted, false);
  });

  test("T2.3: Network drop / stream reader rejection invokes onError", async () => {
    const mockFetch: typeof fetch = async () =>
      createMockFetchResponse(["event: token\ndata: {\"delta\":\"Partial\"}\n\n"], {
        streamOptions: {
          throwAtChunkIndex: 1,
          throwError: new Error("TCP connection reset by peer"),
        },
      });

    await streamChatMessage({
      sessionId,
      content: "Network drop",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
      onError: (err) => capturedErrors.push(err),
      onComplete: () => {
        isCompleted = true;
      },
    });

    assert.equal(capturedErrors.length, 1);
    assert.ok(capturedErrors[0].message.includes("gián đoạn"));
    assert.equal(isCompleted, false);
  });

  test("T2.4: AbortController cancellation mid-stream halts reading without onError", async () => {
    const controller = new AbortController();

    const sseChunks = [
      formatSseString("token", { delta: "Part 1" }),
      formatSseString("token", { delta: "Part 2" }),
      formatSseString("done", { turnId: "t", messageId: "m", reply: "all" }),
    ];

    const mockFetch: typeof fetch = async () =>
      createMockFetchResponse(sseChunks, {
        streamOptions: {
          delayMs: 20,
          abortSignal: controller.signal,
        },
      });

    const streamPromise = streamChatMessage({
      sessionId,
      content: "User abort test",
      signal: controller.signal,
      fetchFn: mockFetch,
      onEvent: (e) => {
        capturedEvents.push(e);
        // Abort immediately after first token arrives
        controller.abort();
      },
      onError: (err) => capturedErrors.push(err),
      onComplete: () => {
        isCompleted = true;
      },
    });

    await streamPromise;

    // Cancellation MUST NOT invoke onError
    assert.equal(capturedErrors.length, 0, "User cancellation must not emit error");
    assert.equal(isCompleted, false);
  });

  test("T2.5: Pre-aborted signal does not execute network fetch", async () => {
    let fetchCalled = false;
    const controller = new AbortController();
    controller.abort(); // Pre-aborted

    const mockFetch: typeof fetch = async () => {
      fetchCalled = true;
      return createMockFetchResponse([]);
    };

    await streamChatMessage({
      sessionId,
      content: "Pre-aborted test",
      signal: controller.signal,
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
      onError: (err) => capturedErrors.push(err),
    });

    assert.equal(fetchCalled, false, "Fetch must not be called when pre-aborted");
    assert.equal(capturedErrors.length, 0);
  });

  test("T2.6: Stream ending abruptly without done event emits friendly premature cutoff error", async () => {
    const sseChunks = [
      formatSseString("token", { delta: "Partial text without done" }),
    ];

    const mockFetch: typeof fetch = async () => createMockFetchResponse(sseChunks);

    await streamChatMessage({
      sessionId,
      content: "Cutoff test",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
      onError: (err) => capturedErrors.push(err),
      onComplete: () => {
        isCompleted = true;
      },
    });

    // 1 token arrived
    assert.equal(capturedEvents.length, 1);
    // Cutoff error should be triggered
    assert.equal(capturedErrors.length, 1);
    assert.ok(capturedErrors[0].message.includes("kết thúc bất ngờ"));
    assert.equal(isCompleted, false);
  });

  // ==========================================
  // TIER 3: INTEGRATION & INTERACTION TESTS
  // ==========================================

  test("T3.1: Null response body from server triggers appropriate error", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(null, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    await streamChatMessage({
      sessionId,
      content: "Null body",
      fetchFn: mockFetch,
      onEvent: (e) => capturedEvents.push(e),
      onError: (err) => capturedErrors.push(err),
    });

    assert.equal(capturedErrors.length, 1);
    assert.ok(capturedErrors[0].message.includes("response body is null"));
  });
});
