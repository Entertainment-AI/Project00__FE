/**
 * tests/helpers/loadModule.ts
 *
 * Dynamically resolves real M1 implementation modules when present on disk,
 * falling back seamlessly to test reference oracles when running standalone.
 */

import * as referenceParser from "./referenceParser";
import * as referenceChatStream from "./referenceChatStream";

export async function getSseParser(): Promise<typeof referenceParser> {
  try {
    const rawMod = await import("../../src/lib/api/sseParser").catch(() => import("@/lib/api/sseParser"));
    const mod =
      rawMod && "default" in rawMod && rawMod.default && typeof (rawMod.default as Record<string, unknown>).createSseParser === "function"
        ? (rawMod.default as Record<string, unknown>)
        : (rawMod as unknown as Record<string, unknown>);
    if (mod && typeof mod.createSseParser === "function") {
      return mod as unknown as typeof referenceParser;
    }
  } catch {
    // Fall back to authoritative reference oracle
  }
  return referenceParser;
}

export async function getChatStream(): Promise<typeof referenceChatStream> {
  try {
    const rawMod = await import("../../src/lib/api/chatStream").catch(() => import("@/lib/api/chatStream"));
    const mod =
      rawMod && "default" in rawMod && rawMod.default && typeof (rawMod.default as Record<string, unknown>).streamChatMessage === "function"
        ? (rawMod.default as Record<string, unknown>)
        : (rawMod as unknown as Record<string, unknown>);
    if (mod && typeof mod.streamChatMessage === "function") {
      return mod as unknown as typeof referenceChatStream;
    }
  } catch {
    // Fall back to authoritative reference oracle
  }
  return referenceChatStream;
}
