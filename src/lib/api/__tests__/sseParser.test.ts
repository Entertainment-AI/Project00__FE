/**
 * src/lib/api/__tests__/sseParser.test.ts
 *
 * Comprehensive Tier 1 (Unit) & Tier 2 (Boundary & Adversarial) test suite
 * for the incremental SSE Parser.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getSseParser } from "../../../../tests/helpers/loadModule";
import type { SseRawEvent, SseParser } from "@/lib/api/sseParser";

describe("Incremental SSE Parser (Tiers 1 & 2)", async () => {
  const { createSseParser, safeJsonParse } = await getSseParser();

  let receivedEvents: SseRawEvent[];
  let receivedErrors: Error[];
  let parser: SseParser;

  beforeEach(() => {
    receivedEvents = [];
    receivedErrors = [];
    parser = createSseParser({
      onEvent: (ev) => receivedEvents.push(ev),
      onError: (err) => receivedErrors.push(err),
    });
  });

  // ==========================================
  // TIER 1: UNIT & CORE BEHAVIOR TESTS
  // ==========================================

  test("T1.1: Single event framing with explicit event name and data", () => {
    parser.feed("event: token\ndata: {\"delta\":\"hello\"}\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.deepEqual(receivedEvents[0], {
      event: "token",
      data: "{\"delta\":\"hello\"}",
    });
    assert.equal(receivedErrors.length, 0);
  });

  test("T1.2: Default event type is 'message' when event field is omitted", () => {
    parser.feed("data: {\"reply\":\"greeting\"}\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "message");
    assert.equal(receivedEvents[0].data, "{\"reply\":\"greeting\"}");
  });

  test("T1.3: Event with id field and optional retry value", () => {
    parser.feed("id: evt-42\nretry: 3000\nevent: metadata\ndata: {\"mood\":\"Happy\"}\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "metadata");
    assert.equal(receivedEvents[0].id, "evt-42");
    assert.equal(receivedEvents[0].retry, 3000);
    assert.equal(receivedEvents[0].data, "{\"mood\":\"Happy\"}");
  });

  test("T1.4: Multiple events packaged inside a single network chunk", () => {
    const chunk = [
      "event: token\ndata: {\"delta\":\"Xin \"}\n\n",
      "event: token\ndata: {\"delta\":\"chào \"}\n\n",
      "event: token\ndata: {\"delta\":\"bạn!\"}\n\n",
    ].join("");

    parser.feed(chunk);

    assert.equal(receivedEvents.length, 3);
    assert.equal(receivedEvents[0].data, "{\"delta\":\"Xin \"}");
    assert.equal(receivedEvents[1].data, "{\"delta\":\"chào \"}");
    assert.equal(receivedEvents[2].data, "{\"delta\":\"bạn!\"}");
  });

  test("T1.5: Multiline data fields concatenated with LF", () => {
    parser.feed("event: multiline\ndata: line 1\ndata: line 2\ndata: line 3\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "multiline");
    assert.equal(receivedEvents[0].data, "line 1\nline 2\nline 3");
  });

  // ==========================================
  // TIER 2: BOUNDARY & ADVERSARIAL TESTS
  // ==========================================

  test("T2.1: Chunks split across field names and colon boundaries", () => {
    parser.feed("ev");
    parser.feed("ent: ");
    parser.feed("token\n");
    parser.feed("da");
    parser.feed("ta: {\"delta\":\"chunked\"}\n");
    parser.feed("\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "token");
    assert.equal(receivedEvents[0].data, "{\"delta\":\"chunked\"}");
  });

  test("T2.2: Chunk split exactly between CR and LF in CRLF delimiter", () => {
    // Chunk 1 ends in \r, Chunk 2 starts with \n
    parser.feed("event: token\r");
    // At this point, parser should NOT trigger premature blank line
    assert.equal(receivedEvents.length, 0);

    parser.feed("\ndata: {\"delta\":\"crlf-split\"}\r\n\r\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "token");
    assert.equal(receivedEvents[0].data, "{\"delta\":\"crlf-split\"}");
  });

  test("T2.3: Pure CRLF (\\r\\n) line breaks across all fields", () => {
    parser.feed("event: metadata\r\ndata: {\"affectionScore\":20}\r\n\r\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "metadata");
    assert.equal(receivedEvents[0].data, "{\"affectionScore\":20}");
  });

  test("T2.4: Mixed line breaks (LF on event, CRLF on data, mixed blank line)", () => {
    parser.feed("event: done\ndata: {\"reply\":\"ok\"}\r\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "done");
    assert.equal(receivedEvents[0].data, "{\"reply\":\"ok\"}");
  });

  test("T2.5: Standalone CR (\\r) line delimiters per WHATWG spec", () => {
    parser.feed("event: token\rdata: {\"delta\":\"cr\"}\r\r");
    parser.flush();

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "token");
    assert.equal(receivedEvents[0].data, "{\"delta\":\"cr\"}");
  });

  test("T2.6: Final buffered event flushed on stream close without trailing double newline", () => {
    // Server disconnects without sending the terminating \n\n
    parser.feed("event: done\ndata: {\"reply\":\"final buffered\"}");

    assert.equal(receivedEvents.length, 0, "Should not emit before flush");

    parser.flush();

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "done");
    assert.equal(receivedEvents[0].data, "{\"reply\":\"final buffered\"}");
  });

  test("T2.7: Idempotent flush call when buffer is empty does not emit phantom event", () => {
    parser.feed("event: token\ndata: {\"delta\":\"A\"}\n\n");
    assert.equal(receivedEvents.length, 1);

    parser.flush();
    parser.flush();

    assert.equal(receivedEvents.length, 1, "Flush on empty buffer must be a no-op");
  });

  test("T2.8: Single-byte character fragmentation stress test", () => {
    const rawWire = "event: token\ndata: {\"delta\":\"fragmented-utf8-thử-nghiệm\"}\n\n";

    // Feed one character at a time
    for (let i = 0; i < rawWire.length; i++) {
      parser.feed(rawWire[i]);
    }

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "token");
    assert.equal(receivedEvents[0].data, "{\"delta\":\"fragmented-utf8-thử-nghiệm\"}");
  });

  test("T2.9: SSE comments and keepalive pings (: ping) are ignored", () => {
    parser.feed(": ping\n");
    parser.feed(": keepalive\r\n");
    parser.feed(":\n"); // Empty comment line
    parser.feed("event: token\n");
    parser.feed(": inter-line ping\n");
    parser.feed("data: {\"delta\":\"alive\"}\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "token");
    assert.equal(receivedEvents[0].data, "{\"delta\":\"alive\"}");
    assert.equal(receivedErrors.length, 0);
  });

  test("T2.10: Leading whitespace after colon stripped according to WHATWG spec", () => {
    // Exactly one space stripped; two spaces retains one space
    parser.feed("event:  custom\ndata:  two-spaces\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, " custom"); // Only one space stripped
    assert.equal(receivedEvents[0].data, " two-spaces");
  });

  test("T2.11: Preserving multiple colons in data payload (URLs and JSON)", () => {
    const payload = "{\"url\":\"http://localhost:5010/api/v1/chat\",\"timestamp\":\"2026-09-09T08:00:00Z\"}";
    parser.feed(`event: token\ndata: ${payload}\n\n`);

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].data, payload);
  });

  test("T2.12: Malformed event lines without colon do not throw or crash parser", () => {
    parser.feed("malformed_line_without_colon\n");
    parser.feed("another random string\n\n");

    // Must not crash or dispatch invalid events
    assert.equal(receivedEvents.length, 0);
    assert.equal(receivedErrors.length, 0);

    // Subsequent valid event parses normally
    parser.feed("event: token\ndata: {\"delta\":\"resilient\"}\n\n");
    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].data, "{\"delta\":\"resilient\"}");
  });

  test("T2.13: Malformed non-JSON data handled cleanly by parser and safeJsonParse", () => {
    parser.feed("event: token\ndata: {this is broken json\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].data, "{this is broken json");

    const parseResult = safeJsonParse(receivedEvents[0].data);
    assert.equal(parseResult.success, false);
    assert.ok(parseResult.error instanceof Error);
  });

  test("T2.14: Stream ending prematurely without 'done' event", () => {
    parser.feed("event: token\ndata: {\"delta\":\"half answer\"}\n\n");
    // Stream ends abruptly
    parser.flush();

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "token");
  });

  test("T2.15: Reset function clears all internal state and prevents cross-stream leakage", () => {
    parser.feed("event: partial\ndata: half data");
    parser.reset();

    // Now send clean new event
    parser.feed("event: fresh\ndata: clean data\n\n");

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0].event, "fresh");
    assert.equal(receivedEvents[0].data, "clean data");
  });

  test("T2.16: Callback exception inside onEvent is forwarded to onError without crashing", () => {
    const errorThrowingParser = createSseParser({
      onEvent: () => {
        throw new Error("Consumer exploded");
      },
      onError: (err) => {
        receivedErrors.push(err);
      },
    });

    // Feeding valid event should trigger onEvent, catch error, and forward to onError
    assert.doesNotThrow(() => {
      errorThrowingParser.feed("event: token\ndata: {}\n\n");
    });

    assert.equal(receivedErrors.length, 1);
    assert.equal(receivedErrors[0].message, "Consumer exploded");
  });
});
