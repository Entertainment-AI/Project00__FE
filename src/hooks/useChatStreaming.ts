"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  streamChatMessage,
  ChatStreamEvent,
  StreamMetadataEvent,
  StreamEventUnlockedEvent,
  StreamDoneEvent,
} from "@/lib/api/chatStream";

export interface UseChatStreamingOptions {
  sessionId: string;
  onToken: (delta: string) => void;
  onMetadata?: (metadata: StreamMetadataEvent) => void;
  onEventUnlocked?: (event: StreamEventUnlockedEvent) => void;
  onDone: (done: StreamDoneEvent) => void;
  onError: (error: Error) => void;
}

export interface SendStreamMessageParams {
  content: string;
  turnId?: string;
}

export interface UseChatStreamingReturn {
  isStreaming: boolean;
  streamingTurnId: string | null;
  sendStreamMessage: (params: SendStreamMessageParams) => Promise<void>;
  stopStreaming: () => void;
}

export function useChatStreaming(options: UseChatStreamingOptions): UseChatStreamingReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);

  // Keep callbacks fresh in ref to prevent stale closures without re-triggering effects
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Clean up any in-flight stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isStreamingRef.current = false;
    setIsStreaming(false);
    setStreamingTurnId(null);
  }, []);

  const sendStreamMessage = useCallback(
    async ({ content, turnId }: SendStreamMessageParams): Promise<void> => {
      // Guard against concurrent streams
      if (isStreamingRef.current) {
        return;
      }

      // Abort any lingering controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      isStreamingRef.current = true;
      setIsStreaming(true);
      if (turnId) {
        setStreamingTurnId(turnId);
      }

      try {
        await streamChatMessage({
          sessionId: optionsRef.current.sessionId,
          content,
          turnId,
          signal: controller.signal,
          onEvent: (event: ChatStreamEvent) => {
            if (controller.signal.aborted) return;

            switch (event.type) {
              case "token":
                optionsRef.current.onToken(event.delta);
                break;
              case "metadata":
                optionsRef.current.onMetadata?.(event);
                break;
              case "event_unlocked":
                optionsRef.current.onEventUnlocked?.(event);
                break;
              case "done":
                optionsRef.current.onDone(event);
                break;
              case "error":
                // In-stream error is also routed to onError in chatStream.ts
                break;
            }
          },
          onError: (err: Error) => {
            if (controller.signal.aborted) return;
            optionsRef.current.onError(err);
          },
        });
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        isStreamingRef.current = false;
        setIsStreaming(false);
        setStreamingTurnId(null);
      }
    },
    []
  );

  return {
    isStreaming,
    streamingTurnId,
    sendStreamMessage,
    stopStreaming,
  };
}
