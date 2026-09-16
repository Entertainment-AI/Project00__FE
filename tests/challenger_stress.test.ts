/**
 * tests/challenger_stress.test.ts
 *
 * Empirical Challenger Stress & Adversarial Test Suite for M1.
 * Tests:
 *  1. 1-byte chunk fragmentation & seeded pseudo-random chunk fuzzing
 *  2. Multi-byte UTF-8, complex emojis, ZWJ sequences & Vietnamese diacritics split across byte chunks
 *  3. Trailing carriage returns (\r) without newline, CRLF splits, standalone CR permutations
 *  4. High-frequency rapid back-to-back feeds & throughput benchmarking (50,000 tokens)
 *  5. Memory leak / heap pressure stress across 100,000 chunks and 1MB payloads
 *  6. Concurrent stream isolation (50 parallel sessions), rapid aborts & network fault injection
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSseParser, type SseRawEvent } from "../src/lib/api/sseParser";
import {
  streamChatMessage,
  type ChatStreamEvent,
  type StreamTokenEvent,
  type StreamDoneEvent,
} from "../src/lib/api/chatStream";

// Seeded PRNG (Mulberry32) for 100% deterministic reproducibility
function createPrng(seed: number) {
  let s = seed;
  return function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("CHALLENGER 1: Empirical Adversarial Stress Suite", () => {
  // =========================================================================
  // VECTOR 1: 1-BYTE CHUNKS & RANDOM CHUNK FRAGMENTATION FUZZING
  // =========================================================================
  test("C1.1: Exact event reconstruction over 1-byte chunk fragmentation (50 events)", () => {
    const receivedEvents: SseRawEvent[] = [];
    const parser = createSseParser({
      onEvent: (ev) => receivedEvents.push(ev),
      onError: (err) => {
        throw err;
      },
    });

    // Generate 50 realistic events
    const expectedEvents: Array<{ event: string; data: string; id?: string }> = [];
    let fullWireStream = "";

    for (let i = 1; i <= 50; i++) {
      let eventType = "token";
      let data = JSON.stringify({ delta: `Từ thứ ${i} trong chuỗi văn bản thử nghiệm... ` });
      let id: string | undefined = undefined;

      if (i === 1) {
        eventType = "metadata";
        data = JSON.stringify({ mood: "Hào hứng", affectionScore: 42 });
      } else if (i === 25) {
        eventType = "event_unlocked";
        data = JSON.stringify({ eventKey: "midway_achievement", context: "Đạt mốc 25 tokens" });
      } else if (i === 50) {
        eventType = "done";
        data = JSON.stringify({ turnId: "turn-final-50", messageId: "msg-final-50", reply: "Hoàn tất." });
      }

      if (i % 5 === 0) {
        id = `evt-${i}`;
      }

      expectedEvents.push({ event: eventType, data, id });

      let wire = "";
      if (id) wire += `id: ${id}\n`;
      wire += `event: ${eventType}\n`;
      wire += `data: ${data}\n\n`;
      fullWireStream += wire;
    }

    // Feed the entire 50-event stream 1 byte (1 character) at a time
    for (let i = 0; i < fullWireStream.length; i++) {
      parser.feed(fullWireStream[i]);
    }
    parser.flush();

    assert.equal(
      receivedEvents.length,
      expectedEvents.length,
      `Expected ${expectedEvents.length} events, got ${receivedEvents.length}`
    );

    for (let i = 0; i < expectedEvents.length; i++) {
      assert.equal(receivedEvents[i].event, expectedEvents[i].event, `Event ${i} type mismatch`);
      assert.equal(receivedEvents[i].data, expectedEvents[i].data, `Event ${i} data mismatch`);
      if (expectedEvents[i].id) {
        assert.equal(receivedEvents[i].id, expectedEvents[i].id, `Event ${i} ID mismatch`);
      }
    }
  });

  test("C1.2: Deterministic pseudo-random chunk fragmentation fuzzing (chunk sizes 1-7 bytes)", () => {
    const prng = createPrng(424242);
    const receivedEvents: SseRawEvent[] = [];
    const parser = createSseParser({
      onEvent: (ev) => receivedEvents.push(ev),
    });

    const expectedEvents: Array<{ event: string; data: string }> = [
      { event: "token", data: JSON.stringify({ delta: "Chào bạn, " }) },
      { event: "token", data: JSON.stringify({ delta: "tôi là trợ lý AI. " }) },
      { event: "metadata", data: JSON.stringify({ mood: "Thân thiện", affectionDelta: 5 }) },
      { event: "token", data: JSON.stringify({ delta: "Rất vui được gặp bạn! 🌟" }) },
      { event: "done", data: JSON.stringify({ turnId: "t1", messageId: "m1", reply: "Chào bạn..." }) },
    ];

    let fullWire = "";
    for (const ev of expectedEvents) {
      fullWire += `: keepalive ping\n`;
      fullWire += `event: ${ev.event}\n`;
      fullWire += `data: ${ev.data}\n\n`;
    }

    // Slice fullWire into random chunks between 1 and 7 characters
    let offset = 0;
    const chunkHistory: string[] = [];
    while (offset < fullWire.length) {
      const chunkSize = 1 + Math.floor(prng() * 7);
      const chunk = fullWire.slice(offset, offset + chunkSize);
      chunkHistory.push(chunk);
      parser.feed(chunk);
      offset += chunkSize;
    }
    parser.flush();

    assert.equal(receivedEvents.length, expectedEvents.length);
    for (let i = 0; i < expectedEvents.length; i++) {
      assert.equal(receivedEvents[i].event, expectedEvents[i].event);
      assert.equal(receivedEvents[i].data, expectedEvents[i].data);
    }
  });

  // =========================================================================
  // VECTOR 2: MULTI-BYTE UTF-8, EMOJIS, ZWJ & VIETNAMESE DIACRITICS
  // =========================================================================
  test("C2.1: Multi-byte UTF-8 emojis split across 1-byte Uint8Array network chunks in chatStream", async () => {
    // We construct a string containing complex 4-byte emojis and Vietnamese diacritics
    const complexText = "Xin chào thế giới! 🐉 🎉 🌟 💖 🔥 Phác họa khoảnh khắc tuyệt mỹ.";
    const sseEvent = `event: token\ndata: ${JSON.stringify({ delta: complexText })}\n\nevent: done\ndata: ${JSON.stringify({ turnId: "t-utf8", messageId: "m-utf8", reply: complexText })}\n\n`;

    // Convert string to raw UTF-8 bytes
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(sseEvent);

    // Create a ReadableStream that delivers exactly 1 byte at a time!
    let byteIndex = 0;
    const byteByByteStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (byteIndex < utf8Bytes.length) {
          const singleByteChunk = new Uint8Array([utf8Bytes[byteIndex++]]);
          controller.enqueue(singleByteChunk);
        } else {
          controller.close();
        }
      },
    });

    const mockFetch: typeof fetch = async () =>
      new Response(byteByByteStream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const receivedEvents: ChatStreamEvent[] = [];
    let completed = false;

    await streamChatMessage({
      sessionId: "sess-utf8-stress",
      content: "Test utf8 byte slicing",
      fetchFn: mockFetch,
      onEvent: (ev) => receivedEvents.push(ev),
      onComplete: () => {
        completed = true;
      },
    });

    assert.equal(completed, true, "Stream must complete successfully");
    assert.equal(receivedEvents.length, 2, "Must receive token and done");

    const tokenEv = receivedEvents[0] as StreamTokenEvent;
    assert.equal(tokenEv.type, "token");
    assert.equal(tokenEv.delta, complexText, "Delta must match exact UTF-8 text with no replacement chars");
    assert.ok(!tokenEv.delta.includes("\uFFFD"), "No Unicode replacement characters (\\uFFFD) allowed!");

    const doneEv = receivedEvents[1] as StreamDoneEvent;
    assert.equal(doneEv.type, "done");
    assert.equal(doneEv.reply, complexText);
  });

  test("C2.2: Complex ZWJ (Zero-Width Joiner) emojis and surrogate pairs in SseParser", () => {
    // Emojis: 👨‍👩‍👧‍👦 (family: 7 code units), ❤️‍🔥 (heart on fire: 4 code units), 🧙‍♀️ (female mage)
    const zwjPayload = JSON.stringify({
      emojis: ["👨‍👩‍👧‍👦", "❤️‍🔥", "🧙‍♀️", "🏳️‍🌈"],
      vietnamese: "Thuở xưa, nàng tiên cá bơi lội giữa đại dương xanh thẳm.",
    });

    const rawSse = `event: token\ndata: ${zwjPayload}\n\n`;

    const received: SseRawEvent[] = [];
    const parser = createSseParser({
      onEvent: (ev) => received.push(ev),
    });

    // Feed character by character
    for (let i = 0; i < rawSse.length; i++) {
      parser.feed(rawSse[i]);
    }
    parser.flush();

    assert.equal(received.length, 1);
    assert.equal(received[0].data, zwjPayload);

    const parsed = JSON.parse(received[0].data);
    assert.deepEqual(parsed.emojis, ["👨‍👩‍👧‍👦", "❤️‍🔥", "🧙‍♀️", "🏳️‍🌈"]);
    assert.equal(parsed.vietnamese, "Thuở xưa, nàng tiên cá bơi lội giữa đại dương xanh thẳm.");
  });

  // =========================================================================
  // VECTOR 3: CARRIAGE RETURN (\r) DELIMITER ADVERSARIAL PERMUTATIONS
  // =========================================================================
  test("C3.1: Standalone CR (\\r) line delimiters and chunk splits without \\n", () => {
    const received: SseRawEvent[] = [];
    const parser = createSseParser({
      onEvent: (ev) => received.push(ev),
    });

    // Test case 1: Standalone CR delimiter between event and data, split across chunk boundaries
    parser.feed("event: token\r");
    // Next chunk starts with 'data: line-alpha\r' -> proves \r is treated as line delimiter
    parser.feed("data: line-alpha\r");
    // Terminating empty line with standalone CR
    parser.feed("\r");
    // Flush to resolve trailing CR
    parser.flush();

    assert.equal(received.length, 1);
    assert.equal(received[0].event, "token");
    assert.equal(received[0].data, "line-alpha");

    // Test case 2: Mixed CRLF and standalone CR with multiple data lines
    parser.feed("event: message\r\ndata: part1\rdata: part2\r\n\r\n");
    assert.equal(received.length, 2);
    assert.equal(received[1].event, "message");
    assert.equal(received[1].data, "part1\npart2");

    // Test case 3: Stream ending with lone \r and trailing buffer flushed
    parser.feed("event: done\rdata: {\"reply\":\"clean\"}\r");
    parser.flush();

    assert.equal(received.length, 3);
    assert.equal(received[2].event, "done");
    assert.equal(received[2].data, "{\"reply\":\"clean\"}");
  });

  test("C3.2: Consecutive trailing carriage returns without newline flushed cleanly", () => {
    const received: SseRawEvent[] = [];
    const parser = createSseParser({
      onEvent: (ev) => received.push(ev),
    });

    parser.feed("event: test\ndata: payload\r\r\r");
    parser.flush();

    assert.equal(received.length, 1);
    assert.equal(received[0].event, "test");
    assert.equal(received[0].data, "payload");
  });

  // =========================================================================
  // VECTOR 4: RAPID BACK-TO-BACK FEEDS & THROUGHPUT BENCHMARK
  // =========================================================================
  test("C4.1: High-throughput benchmark: 20,000 rapid back-to-back tokens", () => {
    let eventCount = 0;
    const parser = createSseParser({
      onEvent: () => {
        eventCount++;
      },
    });

    const tokenChunk = 'event: token\ndata: {"delta":"tok"}\n\n';
    const TOTAL_TOKENS = 20000;

    const start = performance.now();
    for (let i = 0; i < TOTAL_TOKENS; i++) {
      parser.feed(tokenChunk);
    }
    parser.flush();
    const durationMs = performance.now() - start;

    assert.equal(eventCount, TOTAL_TOKENS, "All 20,000 tokens must be parsed");
    const throughput = Math.round((TOTAL_TOKENS / durationMs) * 1000);
    console.log(`\n  [C4.1 Benchmark] 20,000 tokens parsed in ${durationMs.toFixed(2)}ms (${throughput.toLocaleString()} tokens/sec)`);
    assert.ok(throughput > 20000, `Throughput (${throughput} tokens/sec) should exceed 20,000 tokens/sec`);
  });

  // =========================================================================
  // VECTOR 5: MEMORY AND HEAP STABILITY UNDER 100,000 CHUNKS & LARGE PAYLOADS
  // =========================================================================
  test("C5.1: Heap memory stability across 100,000 rapid chunks with reset()", () => {
    if (typeof globalThis.gc === "function") {
      globalThis.gc();
    }

    const initialHeap = process.memoryUsage().heapUsed;
    const parser = createSseParser({
      onEvent: () => {},
    });

    const CHUNK_COUNT = 100000;
    const sampleChunk = 'event: token\ndata: {"delta":"A short conversational response token."}\n\n';

    for (let i = 0; i < CHUNK_COUNT; i++) {
      parser.feed(sampleChunk);
      if (i % 25000 === 0) {
        parser.reset();
      }
    }
    parser.flush();
    parser.reset();

    if (typeof globalThis.gc === "function") {
      globalThis.gc();
    }

    const finalHeap = process.memoryUsage().heapUsed;
    const heapDiffMb = (finalHeap - initialHeap) / (1024 * 1024);

    console.log(`\n  [C5.1 Memory] Heap change after 100,000 chunks: ${heapDiffMb.toFixed(2)} MB`);
    // Heap growth should be minimal (well under 50 MB)
    assert.ok(heapDiffMb < 50, `Heap growth (${heapDiffMb.toFixed(2)} MB) exceeded threshold`);
  });

  test("C5.2: Parsing large 1MB data payload in 16KB TCP-sized chunks", () => {
    const received: SseRawEvent[] = [];
    const parser = createSseParser({
      onEvent: (ev) => received.push(ev),
    });

    // 1MB string of repeated JSON content
    const largeContent = "x".repeat(1024 * 1024);
    const largeEvent = `event: token\ndata: ${largeContent}\n\n`;

    const CHUNK_SIZE = 16 * 1024; // 16KB standard TCP socket buffer
    const start = performance.now();
    for (let i = 0; i < largeEvent.length; i += CHUNK_SIZE) {
      parser.feed(largeEvent.slice(i, i + CHUNK_SIZE));
    }
    parser.flush();
    const duration = performance.now() - start;

    assert.equal(received.length, 1);
    assert.equal(received[0].data.length, largeContent.length);
    assert.equal(received[0].data, largeContent);
    console.log(`\n  [C5.2 Benchmark] 1MB payload parsed across 16KB chunks in ${duration.toFixed(2)}ms`);
  });

  test("C5.3: Empirical verification of line-buffer scanning complexity on fragmented line", () => {
    // 20KB payload
    const content = "a".repeat(20000);
    const eventString = `event: token\ndata: ${content}\n\n`;

    // Strategy 1: Single feed
    let singleResult = "";
    const p1 = createSseParser({ onEvent: (ev) => { singleResult = ev.data; } });
    const t0 = performance.now();
    p1.feed(eventString);
    p1.flush();
    const singleMs = performance.now() - t0;

    // Strategy 2: 64-byte chunks
    let chunkedResult = "";
    const p2 = createSseParser({ onEvent: (ev) => { chunkedResult = ev.data; } });
    const t1 = performance.now();
    for (let i = 0; i < eventString.length; i += 64) {
      p2.feed(eventString.slice(i, i + 64));
    }
    p2.flush();
    const chunkedMs = performance.now() - t1;

    assert.equal(singleResult, content);
    assert.equal(chunkedResult, content);
    console.log(`\n  [C5.3 Benchmark] 20KB payload: single feed ${singleMs.toFixed(2)}ms vs 64B-chunked feed ${chunkedMs.toFixed(2)}ms`);
  });

  // =========================================================================
  // VECTOR 6: CONCURRENCY, RAPID ABORTS & NETWORK FAULT INJECTION
  // =========================================================================
  test("C6.1: 50 concurrent streaming sessions run concurrently with full isolation", async () => {
    const CONCURRENT_SESSIONS = 50;

    const runSession = async (index: number) => {
      const sessionId = `session-concurrent-${index}`;
      const turnId = `turn-${index}`;
      const tokenCount = 10;
      const expectedReply = `Response for session ${index}`;

      const sseEvents: string[] = [
        `event: metadata\ndata: ${JSON.stringify({ mood: "Focused", intensity: index })}\n\n`,
      ];

      for (let t = 0; t < tokenCount; t++) {
        sseEvents.push(`event: token\ndata: ${JSON.stringify({ delta: `s${index}t${t} ` })}\n\n`);
      }

      sseEvents.push(
        `event: done\ndata: ${JSON.stringify({ turnId, messageId: `msg-${index}`, reply: expectedReply })}\n\n`
      );

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          for (const chunk of sseEvents) {
            controller.enqueue(enc.encode(chunk));
          }
          controller.close();
        },
      });

      const mockFetch: typeof fetch = async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });

      const captured: ChatStreamEvent[] = [];
      let isDone = false;

      await streamChatMessage({
        sessionId,
        content: `Prompt for session ${index}`,
        turnId,
        fetchFn: mockFetch,
        onEvent: (ev) => captured.push(ev),
        onComplete: () => {
          isDone = true;
        },
      });

      assert.equal(isDone, true);
      // 1 metadata + 10 tokens + 1 done = 12 events
      assert.equal(captured.length, 12);
      const doneEv = captured[11] as StreamDoneEvent;
      assert.equal(doneEv.type, "done");
      assert.equal(doneEv.turnId, turnId);
      assert.equal(doneEv.reply, expectedReply);
    };

    const sessionPromises = Array.from({ length: CONCURRENT_SESSIONS }, (_, i) => runSession(i));
    await Promise.all(sessionPromises);
  });

  test("C6.2: Rapid abort stress at various chunk indices releases reader lock cleanly", async () => {
    for (let abortAtChunk = 0; abortAtChunk < 5; abortAtChunk++) {
      const controller = new AbortController();
      let chunkCount = 0;

      const sseChunks = [
        'event: token\ndata: {"delta":"A"}\n\n',
        'event: token\ndata: {"delta":"B"}\n\n',
        'event: token\ndata: {"delta":"C"}\n\n',
        'event: token\ndata: {"delta":"D"}\n\n',
        'event: done\ndata: {"turnId":"t","messageId":"m","reply":"ABCD"}\n\n',
      ];

      const stream = new ReadableStream<Uint8Array>({
        pull(ctrl) {
          if (chunkCount < sseChunks.length) {
            ctrl.enqueue(new TextEncoder().encode(sseChunks[chunkCount++]));
          } else {
            ctrl.close();
          }
        },
      });

      const mockFetch: typeof fetch = async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });

      let capturedError: Error | undefined;

      await streamChatMessage({
        sessionId: `abort-test-${abortAtChunk}`,
        content: "Abort test",
        signal: controller.signal,
        fetchFn: mockFetch,
        onEvent: () => {
          if (chunkCount >= abortAtChunk) {
            controller.abort();
          }
        },
        onError: (err) => {
          capturedError = err;
        },
      });

      // Cancellation must NOT invoke onError
      assert.equal(
        capturedError,
        undefined,
        `Abort at chunk ${abortAtChunk} should not trigger onError`
      );
      // Ensure stream reader was cancelled and lock released
      assert.equal(stream.locked, false, `Stream must be unlocked after abort at chunk ${abortAtChunk}`);
    }
  });

  test("C6.3: Malformed JSON in token, metadata, done does not throw unhandled exception", async () => {
    const malformedSse = [
      "event: token\ndata: {unquoted: raw_value}\n\n",
      "event: metadata\ndata: not json at all\n\n",
      "event: event_unlocked\ndata: [broken json\n\n",
      "event: token\ndata: plain text token without json framing\n\n",
      'event: done\ndata: {"turnId":"t-malformed","messageId":"m-malformed","reply":"Safe fallback"}\n\n',
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        const enc = new TextEncoder();
        for (const chunk of malformedSse) {
          ctrl.enqueue(enc.encode(chunk));
        }
        ctrl.close();
      },
    });

    const mockFetch: typeof fetch = async () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const events: ChatStreamEvent[] = [];
    let completed = false;

    await streamChatMessage({
      sessionId: "sess-malformed",
      content: "Test malformed JSON resilience",
      fetchFn: mockFetch,
      onEvent: (ev) => events.push(ev),
      onComplete: () => {
        completed = true;
      },
    });

    assert.equal(completed, true);
    // Malformed token falls back to raw data string
    assert.equal(events[0].type, "token");
    assert.equal((events[0] as StreamTokenEvent).delta, "{unquoted: raw_value}");

    // Plain text token falls back to raw data
    assert.equal(events[1].type, "token");
    assert.equal((events[1] as StreamTokenEvent).delta, "plain text token without json framing");

    // Final done parses cleanly
    assert.equal(events[2].type, "done");
    assert.equal((events[2] as StreamDoneEvent).reply, "Safe fallback");
  });
});
