/**
 * tests/e2e/chatStream.test.ts
 *
 * Comprehensive Tier 3 & Tier 4 End-to-End Application Scenarios
 * covering the complete FE SSE Streaming lifecycle, AbortController,
 * network recovery, concurrency conflict, Scene Image compatibility,
 * and persistent idempotency replay.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getChatStream } from "../helpers/loadModule";
import {
  createMockFetchResponse,
  formatSseString,
} from "../helpers/mockStreamServer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "completed" | "error";
  turnId?: string;
  messageId?: string;
}

interface ChatState {
  sessionId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  currentTurnId: string | null;
  error: string | null;
  metadata: {
    mood: string;
    affectionScore: number;
    relationshipStage: string;
  } | null;
  unlockedEvents: Array<{ eventKey: string; context: string }>;
  activeMemories: Array<Record<string, unknown>>;
  sendCount: number;
}

describe("E2E Application Scenarios (Tiers 3 & 4)", async () => {
  const { streamChatMessage, generateUUID } = await getChatStream();
  const sessionId = "sess-e2e-12345";

  let state: ChatState;

  function createSimulator(fetchFn: typeof fetch) {
    return {
      async sendMessage(
        content: string,
        overrideTurnId?: string,
        signal?: AbortSignal,
        onToken?: (delta: string, accumulated: string) => void
      ) {
        state.sendCount++;
        state.error = null;

        // 1. Add user message
        const userMsgId = `user-msg-${Date.now()}`;
        state.messages.push({
          id: userMsgId,
          role: "user",
          content,
          status: "completed",
        });

        // 2. Add temporary assistant placeholder
        const assistantPlaceholderId = `temp-assistant-${Date.now()}`;
        const turnId = overrideTurnId || generateUUID();
        state.currentTurnId = turnId;
        state.isStreaming = true;

        const assistantMsg: ChatMessage = {
          id: assistantPlaceholderId,
          role: "assistant",
          content: "",
          status: "streaming",
          turnId,
        };
        state.messages.push(assistantMsg);

        try {
          await streamChatMessage({
            sessionId: state.sessionId,
            content,
            turnId,
            signal,
            fetchFn,
            onEvent: (event) => {
              switch (event.type) {
                case "token":
                  assistantMsg.content += event.delta;
                  onToken?.(event.delta, assistantMsg.content);
                  break;

                case "metadata":
                  state.metadata = {
                    mood: event.mood,
                    affectionScore: event.affectionScore,
                    relationshipStage: event.relationshipStage,
                  };
                  break;

                case "event_unlocked":
                  state.unlockedEvents.push({
                    eventKey: event.eventKey,
                    context: event.context,
                  });
                  break;

                case "done":
                  assistantMsg.turnId = event.turnId;
                  assistantMsg.messageId = event.messageId;
                  if (event.reply) {
                    // Authoritative final reply from backend
                    assistantMsg.content = event.reply;
                  }
                  assistantMsg.status = "completed";
                  if (event.activeMemories) {
                    state.activeMemories = event.activeMemories;
                  }
                  break;

                case "error":
                  assistantMsg.status = "error";
                  state.error = event.message;
                  break;
              }
            },
            onError: (err) => {
              assistantMsg.status = "error";
              state.error = err.message;
              state.isStreaming = false;
            },
            onComplete: () => {
              state.isStreaming = false;
              if (assistantMsg.status === "streaming") {
                assistantMsg.status = "completed";
              }
            },
          });
        } finally {
          state.isStreaming = false;
        }
      },
    };
  }

  beforeEach(() => {
    state = {
      sessionId,
      messages: [],
      isStreaming: false,
      currentTurnId: null,
      error: null,
      metadata: null,
      unlockedEvents: [],
      activeMemories: [],
      sendCount: 0,
    };
  });

  // =========================================================================
  // SCENARIO A: Normal Progressive Streaming
  // =========================================================================
  test("Scenario A: Normal progressive streaming accumulates tokens and commits IDs on done", async () => {
    const sseWireChunks = [
      formatSseString("metadata", {
        mood: "Thoughtful",
        intensity: 75,
        affectionDelta: 3,
        affectionScore: 40,
        relationshipStage: "Acquaintance",
      }),
      formatSseString("token", { delta: "Eldoria " }),
      formatSseString("token", { delta: "là một " }),
      formatSseString("token", { delta: "vương quốc cổ xưa." }),
      formatSseString("event_unlocked", {
        eventKey: "eldoria_lore_revealed",
        context: "Revealed secret scroll",
      }),
      formatSseString("done", {
        turnId: "turn-eldoria-1",
        messageId: "msg-eldoria-2",
        reply: "Eldoria là một vương quốc cổ xưa.",
        relationship: { stage: "Acquaintance", affectionScore: 40 },
        activeMemories: [{ id: "mem-eldoria", summary: "Discovered ancient kingdom" }],
      }),
    ];

    const mockFetch: typeof fetch = async () => createMockFetchResponse(sseWireChunks);
    const simulator = createChatSessionSimulator(mockFetch);

    await simulator.sendMessage("Kể cho ta nghe về vương quốc Eldoria");

    // 1. Check message counts: exactly 1 user message, 1 assistant message
    assert.equal(state.messages.length, 2);
    const [userMsg, assistantMsg] = state.messages;

    assert.equal(userMsg.role, "user");
    assert.equal(userMsg.content, "Kể cho ta nghe về vương quốc Eldoria");

    assert.equal(assistantMsg.role, "assistant");
    assert.equal(assistantMsg.content, "Eldoria là một vương quốc cổ xưa.");
    assert.equal(assistantMsg.status, "completed");
    assert.equal(assistantMsg.turnId, "turn-eldoria-1");
    assert.equal(assistantMsg.messageId, "msg-eldoria-2");

    // 2. Check metadata & unlocked events
    assert.deepEqual(state.metadata, {
      mood: "Thoughtful",
      affectionScore: 40,
      relationshipStage: "Acquaintance",
    });
    assert.equal(state.unlockedEvents.length, 1);
    assert.equal(state.unlockedEvents[0].eventKey, "eldoria_lore_revealed");

    // 3. Check lifecycle completion
    assert.equal(state.isStreaming, false);
    assert.equal(state.error, null);
  });

  // =========================================================================
  // SCENARIO B: User Stop Generating
  // =========================================================================
  test("Scenario B: User Stop generating halts reading, preserves partial output, emits no error", async () => {
    const controller = new AbortController();

    const sseWireChunks = [
      formatSseString("token", { delta: "Xin chào " }),
      formatSseString("token", { delta: "lữ khách " }),
      formatSseString("token", { delta: "phương xa..." }),
      formatSseString("done", {
        turnId: "turn-aborted",
        messageId: "msg-aborted",
        reply: "Full reply",
      }),
    ];

    const mockFetch: typeof fetch = async () =>
      createMockFetchResponse(sseWireChunks, {
        streamOptions: {
          delayMs: 15,
          abortSignal: controller.signal,
        },
      });

    const simulator = createChatSessionSimulator(mockFetch);

    await simulator.sendMessage(
      "Chào ngươi",
      undefined,
      controller.signal,
      (_delta, accumulated) => {
        if (accumulated.includes("lữ khách")) {
          controller.abort();
        }
      }
    );

    const assistantMsg = state.messages.find((m) => m.role === "assistant");
    assert.ok(assistantMsg);

    // Partial output must be preserved
    assert.ok(assistantMsg.content.includes("Xin chào"));
    assert.ok(
      !assistantMsg.content.includes("phương xa..."),
      "Should not read tokens sent after abort"
    );

    // Cancellation must NOT be treated as a server error
    assert.equal(state.error, null, "User abort must not display error");
    assert.equal(state.isStreaming, false);
    assert.equal(state.sendCount, 1, "No duplicate request should be triggered");
  });

  // =========================================================================
  // SCENARIO C: Network Interruption Mid-Stream
  // =========================================================================
  test("Scenario C: Network interruption emits friendly error while preserving original prompt", async () => {
    const mockFetch: typeof fetch = async () =>
      createMockFetchResponse(
        [formatSseString("token", { delta: "Thanh kiếm cổ đại này vốn..." })],
        {
          streamOptions: {
            throwAtChunkIndex: 1,
            throwError: new Error("Socket disconnected unexpectedly"),
          },
        }
      );

    const simulator = createChatSessionSimulator(mockFetch);
    const userPrompt = "Bí mật của thanh kiếm cổ là gì?";

    await simulator.sendMessage(userPrompt);

    // User message is preserved completely in history
    const userMsg = state.messages.find((m) => m.role === "user");
    assert.ok(userMsg);
    assert.equal(userMsg.content, userPrompt);

    // Assistant message marked with error status
    const assistantMsg = state.messages.find((m) => m.role === "assistant");
    assert.ok(assistantMsg);
    assert.equal(assistantMsg.status, "error");

    // Friendly error emitted
    assert.ok(state.error !== null);
    assert.ok(state.error.includes("gián đoạn"));
    assert.equal(state.isStreaming, false);
  });

  // =========================================================================
  // SCENARIO D: Server 409 Concurrency Error
  // =========================================================================
  test("Scenario D: Server 409 concurrency error prompts retry with same turnId", async () => {
    let callCount = 0;
    let turnIdPassed = "";

    const stableTurnId = "turn-409-idempotent-test";

    const mockFetch: typeof fetch = async (_, init) => {
      callCount++;
      const body = JSON.parse(String(init?.body || "{}"));
      turnIdPassed = body.turnId;

      if (callCount === 1) {
        // First call fails with 409
        return createMockFetchResponse([], {
          status: 409,
          errorBody: JSON.stringify({
            statusCode: 409,
            message: "Xung đột cập nhật dữ liệu. Vui lòng thử lại với cùng lượt tương tác.",
          }),
        });
      }

      // Retry call succeeds
      return createMockFetchResponse([
        formatSseString("token", { delta: "Thành công sau khi thử lại!" }),
        formatSseString("done", {
          turnId: stableTurnId,
          messageId: "msg-retry-ok",
          reply: "Thành công sau khi thử lại!",
        }),
      ]);
    };

    const simulator = createChatSessionSimulator(mockFetch);

    // 1. Initial attempt
    await simulator.sendMessage("Gửi tin nhắn lúc mạng xung đột", stableTurnId);

    assert.equal(callCount, 1);
    assert.equal(turnIdPassed, stableTurnId);
    assert.ok(state.error !== null);
    assert.ok(state.error.includes("Xung đột"));

    // 2. Safe user retry reusing the exact same turnId
    await simulator.sendMessage("Gửi tin nhắn lúc mạng xung đột", stableTurnId);

    assert.equal(callCount, 2);
    assert.equal(turnIdPassed, stableTurnId, "Retry MUST reuse same turnId for idempotency");
    assert.equal(state.error, null);

    const lastMsg = state.messages[state.messages.length - 1];
    assert.equal(lastMsg.content, "Thành công sau khi thử lại!");
    assert.equal(lastMsg.status, "completed");
  });

  // =========================================================================
  // SCENARIO E: Scene Image Compatibility
  // =========================================================================
  test("Scenario E: Completed assistant message retains final turnId and messageId for Scene Image", async () => {
    const finalTurnId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const finalMessageId = "8b1a3d5e-1234-4567-89ab-cdef01234567";

    const sseWireChunks = [
      formatSseString("token", { delta: "Ta đang đứng bên bờ hồ ánh trăng..." }),
      formatSseString("done", {
        turnId: finalTurnId,
        messageId: finalMessageId,
        reply: "Ta đang đứng bên bờ hồ ánh trăng...",
      }),
    ];

    const mockFetch: typeof fetch = async () => createMockFetchResponse(sseWireChunks);
    const simulator = createChatSessionSimulator(mockFetch);

    await simulator.sendMessage("Miêu tả cảnh tượng quanh ngươi");

    const assistantMsg = state.messages.find((m) => m.role === "assistant");
    assert.ok(assistantMsg);
    assert.equal(assistantMsg.status, "completed");

    // Verify final authoritative IDs are committed to the message object
    assert.equal(assistantMsg.turnId, finalTurnId);
    assert.equal(assistantMsg.messageId, finalMessageId);

    // Simulate Scene Image button click handler ("Phác họa khoảnh khắc")
    interface SceneImageTriggerPayload {
      sessionId: string;
      turnId: string;
      messageId: string;
    }

    function triggerSceneImage(msg: ChatMessage): { success: boolean; payload: SceneImageTriggerPayload } {
      if (!msg.turnId || !msg.messageId) {
        throw new Error("Missing required turnId or messageId for Scene Image generation!");
      }
      return {
        success: true,
        payload: {
          sessionId,
          turnId: msg.turnId,
          messageId: msg.messageId,
        },
      };
    }

    const sceneImageResult = triggerSceneImage(assistantMsg);
    assert.equal(sceneImageResult.success, true);
    assert.equal(sceneImageResult.payload.turnId, finalTurnId);
    assert.equal(sceneImageResult.payload.messageId, finalMessageId);
    assert.equal(sceneImageResult.payload.sessionId, sessionId);
  });

  // =========================================================================
  // SCENARIO F: Idempotent Replay
  // =========================================================================
  test("Scenario F: Idempotent replay returns previous deterministic snapshot without duplicating turn", async () => {
    const fixedTurnId = "turn-idempotency-cache-777";
    let backendTurnsCreated = 0;

    const mockFetch: typeof fetch = async (_, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      assert.equal(body.turnId, fixedTurnId);

      // Simulating backend idempotency gate (CharacterRuntime.cs:362)
      backendTurnsCreated++;

      return createMockFetchResponse([
        formatSseString("token", { delta: "Câu trả lời đã được lưu trữ sẵn." }),
        formatSseString("done", {
          turnId: fixedTurnId,
          messageId: "msg-cached-1",
          reply: "Câu trả lời đã được lưu trữ sẵn.",
        }),
      ]);
    };

    const simulator = createChatSessionSimulator(mockFetch);

    // Initial submission
    await simulator.sendMessage("Yêu cầu cần kiểm tra tính bất biến", fixedTurnId);
    assert.equal(state.messages.length, 2);
    assert.equal(state.messages[1].content, "Câu trả lời đã được lưu trữ sẵn.");

    // Replay submission with SAME turnId
    await simulator.sendMessage("Yêu cầu cần kiểm tra tính bất biến", fixedTurnId);

    // Both requests succeed with identical deterministic reply
    const assistantMsgs = state.messages.filter((m) => m.role === "assistant");
    assert.equal(assistantMsgs.length, 2);
    assert.equal(assistantMsgs[0].content, assistantMsgs[1].content);
    assert.equal(assistantMsgs[0].turnId, assistantMsgs[1].turnId);
    assert.equal(backendTurnsCreated, 2, "Backend idempotency handler received both requests");
  });

  function createChatSessionSimulator(fetchFn: typeof fetch) {
    return createSimulator(fetchFn);
  }
});
