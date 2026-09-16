"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  Loader2,
  X,
  Heart,
  Lightbulb,
  PanelLeft,
  PanelRight,
  Sparkles,
  ShieldAlert,
  Square,
} from "lucide-react";
import { ChatMessage, ChatSession, ChatSessionListItem, MessageRole, Character } from "@/types";
import { useChatStreaming } from "@/hooks/useChatStreaming";
import {
  generateUUID,
  StreamMetadataEvent,
  StreamEventUnlockedEvent,
  StreamDoneEvent,
} from "@/lib/api/chatStream";
import {
  fetchChatSession,
  fetchCharacterById,
  createChatSession,
  rollbackChatMessage,
  fetchRoleplaySuggestions,
  fetchRecentSessions,
  triggerTurnSceneImage,
  getSceneImageStatus,
} from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/core/providers/AuthProvider";

import {
  ChatTheme,
  THEMES,
  getAffectionStage,
  CATEGORY_MAP,
  formatPersonalityForUser,
} from "@/components/chat/chat.constants";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import { CharacterProfileSidebar } from "@/components/chat/CharacterProfileSidebar";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { ThemePicker } from "@/components/chat/ThemePicker";
import { AffectionModal } from "@/components/chat/AffectionModal";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";

interface TurnImageState {
  status: "idle" | "queued" | "pending" | "processing" | "completed" | "failed" | "timeout" | "cancelled";
  imageUrl?: string;
  generationRequestId?: string;
  failureReason?: string;
}

export default function ChatPage() {
  const { user, isAuthenticated, isLoading: authLoading, openAuthModal } = useAuth();
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  // Session & Message State
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // 3-Panel Layout State
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [recentSessions, setRecentSessions] = useState<ChatSessionListItem[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Theme & Modals State
  const [currentTheme, setCurrentTheme] = useState<ChatTheme>("cyan");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showAffectionModal, setShowAffectionModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Affection & Emotion Level
  const [affectionScore, setAffectionScore] = useState<number>(0);
  const [character, setCharacter] = useState<Character | null>(null);
  const [levelUpNotif, setLevelUpNotif] = useState<ReturnType<typeof getAffectionStage> | null>(null);

  // Interaction State
  const [rollbackTarget, setRollbackTarget] = useState<{ id: string; index: number } | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [turnImageStateMap, setTurnImageStateMap] = useState<Record<string, TurnImageState>>({});
  const activePollingRef = useRef<Record<string, NodeJS.Timeout>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isUserNearBottomRef = useRef(true);
  const activeTurnIdRef = useRef<string | null>(null);

  const theme = THEMES[currentTheme] || THEMES.cyan;
  const currentStage = getAffectionStage(affectionScore);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserNearBottomRef.current = distanceFromBottom < 100;
  };

  const scrollToBottom = (force = false) => {
    if (force || isUserNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Load Saved Theme
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("roleplay_chat_theme") as ChatTheme;
      if (saved && THEMES[saved]) {
        setCurrentTheme(saved);
      }
    }
  }, []);

  const handleSelectTheme = (newTheme: ChatTheme) => {
    setCurrentTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("roleplay_chat_theme", newTheme);
    }
  };

  // Fetch Current Session & Messages (with Real Database Affection Score)
  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;
    setIsLoading(true);
    setNotFound(false);

    fetchChatSession(sessionId)
      .then((data) => {
        if (!isMounted) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setSession(data);
        setMessages(data.messages || []);
        if (typeof data.affectionScore === "number") {
          setAffectionScore(data.affectionScore);
        }

        const initialImageMap: Record<string, TurnImageState> = {};
        data.messages?.forEach((m) => {
          if (!m.turnId) return;
          const turnId = m.turnId;
          const status = m.sceneImageStatus;

          if (
            status === "processing" ||
            status === "pending" ||
            status === "queued"
          ) {
            // Prioritize active in-flight generation/regeneration!
            initialImageMap[turnId] = {
              status: status,
              imageUrl: m.sceneImageUrl || undefined,
              generationRequestId: m.generationRequestId || undefined,
            };
            if (m.generationRequestId) {
              startPolling(turnId, m.generationRequestId);
            }
          } else if (m.sceneImageUrl) {
            initialImageMap[turnId] = {
              status: "completed",
              imageUrl: m.sceneImageUrl,
              generationRequestId: m.generationRequestId || undefined,
            };
          } else if (status === "failed" || status === "cancelled") {
            initialImageMap[turnId] = {
              status: status,
              imageUrl: m.sceneImageUrl || undefined,
              generationRequestId: m.generationRequestId || undefined,
            };
          }
        });
        setTurnImageStateMap(initialImageMap);

        if (data.characterId) {
          fetchCharacterById(data.characterId)
            .then((char) => {
              if (isMounted && char) setCharacter(char);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error loading chat session", err);
        setNotFound(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  // Fetch Recent Sessions List for Left Sidebar
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingRecent(true);
    fetchRecentSessions()
      .then((data) => setRecentSessions(data || []))
      .catch((err) => console.warn("Could not load recent sessions:", err))
      .finally(() => setIsLoadingRecent(false));
  }, [isAuthenticated, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Fetch AI Roleplay Suggestions
  const handleFetchSuggestions = async () => {
    if (isLoadingSuggestions || isSending) return;
    try {
      setIsLoadingSuggestions(true);
      setShowSuggestions(true);
      const res = await fetchRoleplaySuggestions(sessionId);
      if (res && res.length > 0) {
        setSuggestions(res);
      } else {
        const name = session?.characterName || "nàng";
        setSuggestions([
          `*Khẽ mỉm cười, nhìn thẳng vào mắt ${name} và nhẹ nhàng gật đầu*`,
          `*Lùi lại một bước, ánh mắt thăm dò vẻ mặt của ${name}*`,
          `*Im lặng quan sát, chờ xem phản ứng và diễn biến tiếp theo*`,
        ]);
      }
    } catch (err) {
      console.warn("Could not fetch suggestions", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // 1. Streaming Hook Integration
  const { isStreaming, sendStreamMessage, stopStreaming } = useChatStreaming({
    sessionId,
    onToken: (delta: string) => {
      const currentTurnId = activeTurnIdRef.current;
      setMessages((prev) =>
        prev.map((m) =>
          m.turnId === currentTurnId && m.isStreaming
            ? { ...m, content: m.content + delta }
            : m
        )
      );
      scrollToBottom();
    },
    onMetadata: (meta: StreamMetadataEvent) => {
      if (typeof meta.affectionScore === "number") {
        const oldSt = getAffectionStage(affectionScore);
        const newSt = getAffectionStage(meta.affectionScore);
        setAffectionScore(meta.affectionScore);

        if (newSt.level > oldSt.level) {
          setLevelUpNotif(newSt);
          setTimeout(() => setLevelUpNotif(null), 4500);
        }

        setSession((prev) =>
          prev
            ? {
                ...prev,
                affectionScore: meta.affectionScore,
                relationshipStage: meta.relationshipStage,
                currentMood: meta.mood,
                moodIntensity: meta.intensity,
              }
            : null
        );
      }
    },
    onEventUnlocked: (evt: StreamEventUnlockedEvent) => {
      setSession((prev) => {
        if (!prev) return null;
        const exists = prev.unlockedEvents?.some((e) => e.eventKey === evt.eventKey);
        if (exists) return prev;
        return {
          ...prev,
          unlockedEvents: [
            ...(prev.unlockedEvents || []),
            { eventKey: evt.eventKey, context: evt.context, unlockedAt: new Date().toISOString() },
          ],
        };
      });
    },
    onDone: (done: StreamDoneEvent) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.turnId === done.turnId && m.isStreaming
            ? {
                ...m,
                id: done.messageId,
                content: done.reply || m.content,
                turnId: done.turnId,
                isStreaming: false,
              }
            : m
        )
      );

      if (done.relationship && typeof done.relationship === "object") {
        const rel = done.relationship;
        if (typeof rel.affectionScore === "number") {
          const oldSt = getAffectionStage(affectionScore);
          const newSt = getAffectionStage(rel.affectionScore as number);
          setAffectionScore(rel.affectionScore as number);

          if (newSt.level > oldSt.level) {
            setLevelUpNotif(newSt);
            setTimeout(() => setLevelUpNotif(null), 4500);
          }

          setSession((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              affectionScore: rel.affectionScore as number,
              relationshipLevel: typeof rel.relationshipLevel === "number" ? rel.relationshipLevel : prev.relationshipLevel,
              relationshipStage: typeof rel.relationshipStage === "string" ? rel.relationshipStage : prev.relationshipStage,
              currentMood: typeof rel.currentMood === "string" ? rel.currentMood : prev.currentMood,
              moodIntensity: typeof rel.moodIntensity === "number" ? rel.moodIntensity : prev.moodIntensity,
            };
          });
        }
      }
      activeTurnIdRef.current = null;
      scrollToBottom(true);
    },
    onError: (err: Error) => {
      const currentTurnId = activeTurnIdRef.current;
      setMessages((prev) =>
        prev.map((m) =>
          m.turnId === currentTurnId && m.isStreaming
            ? {
                ...m,
                isStreaming: false,
                content: m.content || "*(Không thể nhận phản hồi trọn vẹn do sự cố kết nối)*",
              }
            : m
        )
      );
      activeTurnIdRef.current = null;
      alert(err.message || "Không thể nhận phản hồi từ AI. Vui lòng thử lại!");
    },
  });

  const handleStopGenerating = () => {
    stopStreaming();
    const currentTurnId = activeTurnIdRef.current;
    if (currentTurnId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.turnId === currentTurnId && m.isStreaming
            ? { ...m, isStreaming: false }
            : m
        )
      );
      activeTurnIdRef.current = null;
    }
  };

  // Send Message with Real-Time SSE Streaming
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isSending || isStreaming) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    const turnId = generateUUID();
    activeTurnIdRef.current = turnId;

    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: MessageRole.User,
      content: userText,
      timestamp: new Date().toISOString(),
    };

    const tempAssistantMsg: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: MessageRole.Assistant,
      content: "",
      timestamp: new Date().toISOString(),
      turnId,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);
    setIsSending(true);

    try {
      await sendStreamMessage({ content: userText, turnId });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmRollback = async () => {
    if (!rollbackTarget || isRollingBack) return;
    try {
      setIsRollingBack(true);
      await rollbackChatMessage(sessionId, rollbackTarget.id);
      setMessages((prev) => prev.slice(0, rollbackTarget.index + 1));
      setRollbackTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error rolling back", err);
      alert(message || "Không thể quay về mốc này. Vui lòng thử lại!");
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleContinueStory = async () => {
    if (isSending || isStreaming) return;
    const prompt = "*Lặng im quan sát, chờ xem phản ứng và diễn biến tiếp theo từ ngươi...*";
    setInputMessage("");

    const turnId = generateUUID();
    activeTurnIdRef.current = turnId;

    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      role: MessageRole.User,
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    const tempAssistantMsg: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: MessageRole.Assistant,
      content: "",
      timestamp: new Date().toISOString(),
      turnId,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);
    setIsSending(true);

    try {
      await sendStreamMessage({ content: prompt, turnId });
    } finally {
      setIsSending(false);
    }
  };

  const handleRegenerateLastResponse = async () => {
    if (isSending || isStreaming || messages.length === 0) return;

    const userMessages = messages.filter(
      (m) =>
        m.role === MessageRole.User ||
        (m.role as unknown as number) === 1 ||
        String(m.role).toLowerCase() === "user"
    );

    const lastUserText =
      userMessages.length > 0
        ? userMessages[userMessages.length - 1].content
        : `*Nhìn ${session?.characterName || "ngươi"} với ánh mắt tò mò, chờ đợi một phản ứng khác...*`;

    const turnId = generateUUID();
    activeTurnIdRef.current = turnId;

    const tempAssistantMsg: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: MessageRole.Assistant,
      content: "",
      timestamp: new Date().toISOString(),
      turnId,
      isStreaming: true,
    };

    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        const isAI =
          copy[i].role === MessageRole.Assistant ||
          (copy[i].role as unknown as number) === 2 ||
          String(copy[i].role).toLowerCase() === "assistant";
        if (isAI) {
          copy.splice(i, 1);
          break;
        }
      }
      return [...copy, tempAssistantMsg];
    });

    setIsSending(true);

    try {
      await sendStreamMessage({ content: lastUserText, turnId });
    } finally {
      setIsSending(false);
    }
  };

  // Cleanup active polling timeouts when switching sessions or unmounting
  useEffect(() => {
    return () => {
      Object.values(activePollingRef.current).forEach((timer) => clearTimeout(timer));
      activePollingRef.current = {};
    };
  }, [sessionId]);

  const startPolling = (turnId: string, generationRequestId: string) => {
    if (activePollingRef.current[turnId]) {
      clearTimeout(activePollingRef.current[turnId]);
      delete activePollingRef.current[turnId];
    }

    let iterations = 0;
    let consecutiveErrors = 0;
    const maxIterations = 120; // 3 minutes max (120 * 1.5s)

    const poll = async () => {
      iterations++;
      if (iterations > maxIterations) {
        delete activePollingRef.current[turnId];
        setTurnImageStateMap((prev) => ({
          ...prev,
          [turnId]: {
            status: "timeout",
            failureReason: "Hết thời gian chờ phản hồi từ máy chủ. Vui lòng làm mới trang hoặc thử lại sau.",
            generationRequestId,
          },
        }));
        return;
      }

      try {
        const statusRes = await getSceneImageStatus(generationRequestId);
        consecutiveErrors = 0;

        if (statusRes.status === "completed" && statusRes.imageUrl) {
          delete activePollingRef.current[turnId];
          setTurnImageStateMap((prev) => ({
            ...prev,
            [turnId]: {
              status: "completed",
              imageUrl: statusRes.imageUrl || undefined,
              generationRequestId,
            },
          }));
          setMessages((prev) =>
            prev.map((m) => {
              if (m.turnId === turnId) {
                return {
                  ...m,
                  sceneImageUrl: statusRes.imageUrl,
                  sceneImageStatus: "completed",
                  generationRequestId,
                };
              }
              return m;
            })
          );
          return;
        } else if (statusRes.status === "failed") {
          delete activePollingRef.current[turnId];
          setTurnImageStateMap((prev) => ({
            ...prev,
            [turnId]: {
              status: "failed",
              failureReason: statusRes.failureReason || "Không thể tạo ảnh cho khoảnh khắc này.",
              generationRequestId,
            },
          }));
          return;
        } else if (statusRes.status === "cancelled") {
          delete activePollingRef.current[turnId];
          setTurnImageStateMap((prev) => ({
            ...prev,
            [turnId]: {
              status: "cancelled",
              failureReason: "Yêu cầu vẽ ảnh đã bị hủy.",
              generationRequestId,
            },
          }));
          return;
        } else {
          // queued, pending, processing
          setTurnImageStateMap((prev) => ({
            ...prev,
            [turnId]: {
              status: statusRes.status as TurnImageState["status"],
              generationRequestId,
            },
          }));
        }
      } catch (err) {
        consecutiveErrors++;
        console.warn(`[Polling] Network error (${consecutiveErrors}/3) for turn ${turnId}:`, err);
        if (consecutiveErrors >= 3) {
          delete activePollingRef.current[turnId];
          setTurnImageStateMap((prev) => ({
            ...prev,
            [turnId]: {
              status: "timeout",
              failureReason: "Mất kết nối với máy chủ khi đang tạo ảnh. Vui lòng thử lại sau!",
              generationRequestId,
            },
          }));
          return;
        }
      }

      // Schedule next poll sequentially after current response finishes
      activePollingRef.current[turnId] = setTimeout(poll, 1500);
    };

    // Trigger initial poll
    activePollingRef.current[turnId] = setTimeout(poll, 1500);
  };

  const handleTriggerTurnImage = async (turnId: string) => {
    if (!sessionId) return;
    const currentState = turnImageStateMap[turnId];
    if (
      currentState?.status === "queued" ||
      currentState?.status === "processing" ||
      currentState?.status === "pending"
    ) {
      return; // double-click protection
    }

    setTurnImageStateMap((prev) => ({
      ...prev,
      [turnId]: { status: "queued" },
    }));

    try {
      const triggerRes = await triggerTurnSceneImage(sessionId, turnId);
      if (triggerRes.generationRequestId) {
        setTurnImageStateMap((prev) => ({
          ...prev,
          [turnId]: { status: "queued", generationRequestId: triggerRes.generationRequestId },
        }));
        startPolling(turnId, triggerRes.generationRequestId);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Error triggering scene image generation:", err);
      setTurnImageStateMap((prev) => ({
        ...prev,
        [turnId]: {
          status: "failed",
          failureReason: errMsg || "Không thể kích hoạt vẽ ảnh.",
        },
      }));
    }
  };

  const handleCancelTurnImage = (turnId: string) => {
    if (activePollingRef.current[turnId]) {
      clearTimeout(activePollingRef.current[turnId]);
      delete activePollingRef.current[turnId];
    }
    setTurnImageStateMap((prev) => {
      const current = prev[turnId];
      return {
        ...prev,
        [turnId]: {
          status: "cancelled",
          imageUrl: current?.imageUrl,
          failureReason: "Yêu cầu vẽ ảnh đã được hủy.",
          generationRequestId: current?.generationRequestId,
        },
      };
    });
  };

  const handleCreateNewSession = async () => {
    if (!session?.characterId) return;
    try {
      setIsCreatingNew(true);
      const newSession = await createChatSession(
        session.characterId,
        `Trò chuyện cùng ${session.characterName}`
      );
      router.push(`/chat/${newSession.id}`);
    } catch (err) {
      console.error("Failed to start new chat session", err);
      alert("Không thể tạo cuộc trò chuyện mới. Vui lòng thử lại!");
    } finally {
      setIsCreatingNew(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auth & Status Guards
  if (authLoading || isLoading) {
    return <ChatSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#18191c] p-6 text-center text-zinc-100 selection:bg-[#353740] selection:text-white">
        <div className="mx-auto max-w-sm rounded-3xl border border-[#31333a] bg-[#212227] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3b3d46] bg-[#292a33] text-zinc-200 shadow-inner">
            <X className="h-6 w-6 text-zinc-400" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Cần đăng nhập</h2>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-normal">
            Bạn cần đăng nhập để tiếp tục cuộc trò chuyện nhập vai và lưu giữ ký ức với nhân vật.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={openAuthModal}
              className="w-full rounded-2xl bg-zinc-100 py-3 text-xs font-bold text-zinc-950 hover:bg-white shadow-md transition-all active:scale-95 cursor-pointer"
            >
              Đăng nhập ngay
            </button>
            <Link
              href="/"
              className="w-full rounded-2xl border border-[#31333a] bg-[#26272e] py-2.5 text-xs font-semibold text-zinc-300 hover:bg-[#2f3139] hover:text-white transition-all text-center"
            >
              Quay lại Trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#18191c] p-6 text-center text-zinc-100 selection:bg-[#353740] selection:text-white">
        <div className="mx-auto max-w-sm rounded-3xl border border-[#31333a] bg-[#212227] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3b3d46] bg-[#292a33] text-zinc-200 shadow-inner">
            <X className="h-6 w-6 text-zinc-400" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Cuộc trò chuyện không tồn tại</h2>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-normal">
            Phiên chat này không thuộc về tài khoản của bạn hoặc đã bị xóa.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full rounded-2xl bg-zinc-100 py-3 text-xs font-bold text-zinc-950 hover:bg-white shadow-md transition-all active:scale-95 text-center"
            >
              Quay lại Trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#18191c] text-zinc-100">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
        <p className="mt-4 text-sm text-zinc-400">Đang tải phòng chat nhập vai...</p>
      </div>
    );
  }

  // Calculate Last AI Message for Action Buttons
  const lastAIMessageIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const isAI =
        messages[i].role === MessageRole.Assistant ||
        (messages[i].role as unknown as number) === 2 ||
        String(messages[i].role).toLowerCase() === "assistant";
      if (isAI) return i;
    }
    return -1;
  })();

  return (
    <div className="flex h-screen w-full flex-col bg-[#141518] text-zinc-100 overflow-hidden selection:bg-[#353740] selection:text-white">
      {/* GLOBAL TOP HEADER: Cân xứng 1:1 chuẩn Antigravity / IDE */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-[#26272e] bg-[#1a1b20] px-3.5 backdrop-blur-md z-30">
        {/* Left Section: Nút Toggle Sidebar Trái + Thông Tin Nhân Vật Tối Giản */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
              showLeftSidebar
                ? `bg-[#282932] ${theme.badgeText} border border-[#373944]`
                : "text-zinc-400 hover:bg-[#282930] hover:text-zinc-100 border border-transparent"
            }`}
            title={showLeftSidebar ? "Thu gọn danh sách hội thoại" : "Mở danh sách hội thoại"}
          >
            <PanelLeft className="h-4.5 w-4.5" />
          </button>

          {/* Character Identity & Status */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-[#2e3038]/80">
            <Avatar
              src={session?.characterAvatar}
              alt={session?.characterName || "AI"}
              size="sm"
              type="character"
              className="!rounded-xl border border-[#3b3d46] h-7 w-7 shrink-0"
            />
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-zinc-100">{session?.characterName}</h1>
              {session?.characterCategory && (
                <span className="rounded-lg bg-[#272832] px-2 py-0.5 text-[10px] font-bold text-zinc-300 border border-[#373944] hidden sm:inline">
                  {CATEGORY_MAP[session.characterCategory] || session.characterCategory}
                </span>
              )}
              <span className="flex h-2 w-2 relative ml-0.5 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${theme.onlinePing} opacity-75`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${theme.onlineDot}`}
                ></span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Nút điều khiển cân xứng 1:1 */}
        <div className="flex items-center gap-2">
          {/* Quick Heart Affection Level Pill */}
          <button
            type="button"
            onClick={() => setShowAffectionModal(true)}
            className={`flex items-center gap-1.5 rounded-xl border ${currentStage.badgeBg} ${currentStage.badgeBorder} px-2.5 py-1 text-xs font-bold ${currentStage.color} hover:brightness-110 transition-all cursor-pointer shadow-xs`}
            title="Bấm để xem chi tiết Mối quan hệ & 5 Cột mốc đặc quyền"
          >
            <Heart className={`h-3.5 w-3.5 ${currentStage.heartColor}`} />
            <span>{affectionScore}%</span>
          </button>

          {/* Live Theme Switcher */}
          <ThemePicker
            currentTheme={currentTheme}
            onSelectTheme={handleSelectTheme}
            isOpen={showThemePicker}
            onToggle={() => setShowThemePicker(!showThemePicker)}
            onClose={() => setShowThemePicker(false)}
          />

          {/* Toggle Right Sidebar Button (Icon vuông đối xứng 1:1 với bên trái) */}
          <button
            type="button"
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
              showRightSidebar
                ? `bg-[#282932] ${theme.badgeText} border border-[#373944]`
                : "text-zinc-400 hover:bg-[#282930] hover:text-zinc-100 border border-transparent"
            }`}
            title={showRightSidebar ? "Thu gọn hồ sơ nhân vật" : "Mở hồ sơ & hảo cảm nhân vật"}
          >
            <PanelRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* 3-PANEL BODY (Nằm dưới Top Header) */}
      <div className="flex flex-1 w-full min-h-0 overflow-hidden relative">
        {/* 1. LEFT SIDEBAR: Danh Sách Hội Thoại */}
        <ChatHistorySidebar
          isOpen={showLeftSidebar}
          onClose={() => setShowLeftSidebar(false)}
          currentSessionId={sessionId}
          recentSessions={recentSessions}
          isLoading={isLoadingRecent}
          isCreatingNew={isCreatingNew}
          onCreateNewSession={handleCreateNewSession}
          onSelectSession={(id) => router.push(`/chat/${id}`)}
          theme={theme}
        />

        {/* 2. CENTER PANEL: Phòng Chat Hội Thoại Chính */}
        <div className="flex flex-1 flex-col h-full min-w-0 bg-[#18191c] relative overflow-hidden">

        {/* Chat Messages Area */}
        <main ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="mx-auto max-w-3xl space-y-5">
            {/* Top Character Context Banner */}
            <div className="flex flex-col items-center justify-center text-center pt-2 pb-6 border-b border-[#2c2e35]/60 animate-in fade-in duration-300">
              <Avatar
                src={session?.characterAvatar}
                alt={session?.characterName || "AI"}
                size="lg"
                type="character"
                className="!rounded-3xl border border-[#3b3d46] shadow-xl mb-3"
              />
              <h3 className="text-base font-bold text-zinc-100">{session?.characterName}</h3>
              <p className="text-xs text-zinc-400 max-w-md mt-1 font-normal leading-relaxed">
                {formatPersonalityForUser(
                  session?.characterPersonality,
                  session?.characterName
                ) || "Bắt đầu cuộc hành trình nhập vai cùng nhân vật..."}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-[#26272e] px-3 py-1 text-[11px] font-medium text-zinc-300 border border-[#33353e]">
                  {session?.characterCategory
                    ? CATEGORY_MAP[session.characterCategory] || session.characterCategory
                    : "Nhập vai"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold border ${currentStage.badgeBg} ${currentStage.badgeBorder} ${currentStage.color}`}
                >
                  💖 {currentStage.name} ({affectionScore}%)
                </span>
              </div>
            </div>

            {/* Chat Messages Stream */}
            {messages.map((msg, index) => {
              const isUser =
                msg.role === MessageRole.User ||
                (msg.role as unknown as number) === 1 ||
                String(msg.role).toLowerCase() === "user";
              const isOpeningMessage = index === 0 && !isUser;
              const isLatestAI = !isUser && index === lastAIMessageIndex;

              const effectiveTurnId = msg.turnId || undefined;
              const turnImgState = effectiveTurnId ? turnImageStateMap[effectiveTurnId] : undefined;
              const itemSceneImageUrl = turnImgState?.imageUrl || msg.sceneImageUrl;
              const itemSceneImageStatus =
                turnImgState?.status ||
                (msg.sceneImageUrl ? "completed" : (msg.sceneImageStatus as TurnImageState["status"]) || "idle");
              const itemFailureReason = turnImgState?.failureReason;

              return (
                <ChatMessageItem
                  key={msg.id || index}
                  msg={msg}
                  index={index}
                  isUser={isUser}
                  isOpeningMessage={isOpeningMessage}
                  isLatestAI={isLatestAI}
                  canRollback={index < messages.length - 1}
                  theme={theme}
                  session={session}
                  userAvatarUrl={user?.avatarUrl}
                  userName={user?.userName}
                  copiedId={copiedId}
                  isSending={isSending}
                  isRollingBack={isRollingBack}
                  isLoadingSuggestions={isLoadingSuggestions}
                  sceneImageUrl={itemSceneImageUrl || undefined}
                  sceneImageStatus={itemSceneImageStatus}
                  sceneImageFailureReason={itemFailureReason}
                  onCopy={handleCopyMessage}
                  onRollback={(id, idx) => setRollbackTarget({ id, index: idx })}
                  onFetchSuggestions={handleFetchSuggestions}
                  onContinueStory={handleContinueStory}
                  onRegenerate={handleRegenerateLastResponse}
                  onImagineScene={handleTriggerTurnImage}
                  onRegenerateScene={handleTriggerTurnImage}
                  onCancelScene={handleCancelTurnImage}
                />
              );
            })}

            {/* Roleplay Interactive Action Suggestions Box */}
            {suggestions.length > 0 && showSuggestions && (
              <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between px-1 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <Lightbulb className="h-3.5 w-3.5" />
                    <span>Gợi ý hành động nhập vai:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(false)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Ẩn gợi ý
                  </button>
                </div>

                <div className="space-y-1.5">
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInputMessage(sug)}
                      disabled={isSending}
                      className={`w-full text-left rounded-2xl border px-3.5 py-2.5 text-xs transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50 ${theme.chipBorder} ${theme.chipBg} ${theme.chipText} ${theme.chipHoverBorder} ${theme.chipHoverBg} ${theme.chipHoverText}`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Bar */}
        <footer className="border-t border-[#23242a] bg-[#141518]/95 px-3 py-2.5 backdrop-blur-xl shrink-0">
          <div className="mx-auto max-w-3xl">
            {session?.status === 2 || (session?.status as unknown as string) === "WalkedOut" || (session?.status as unknown as string) === "2" ? (
              <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 text-center space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-red-300">
                  <ShieldAlert className="h-4 w-4 text-red-400" />
                  <span>{session?.characterName} đã rời khỏi và đóng cuộc trò chuyện này</span>
                </div>
                {session?.walkOutReason && (
                  <p className="text-xs text-red-200/90 italic bg-[#171114] p-2.5 rounded-xl border border-red-500/20 max-w-lg mx-auto">
                    &quot;{session.walkOutReason}&quot;
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleCreateNewSession}
                  disabled={isCreatingNew}
                  className="px-5 py-2 rounded-xl bg-zinc-100 text-zinc-950 text-xs font-bold hover:bg-white active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  {isCreatingNew ? "Đang Khởi Tạo..." : "Bắt Đầu Cuộc Trò Chuyện Mới"}
                </button>
              </div>
            ) : (
              <>
                <form
                  onSubmit={handleSendMessage}
                  className="group relative flex items-end gap-2 rounded-2xl border border-[#2e3037] bg-[#1d1e23] p-1.5 pl-3.5 shadow-md transition-all focus-within:border-[#4d505c] focus-within:bg-[#22242a]"
                >
                  <textarea
                    rows={1}
                    value={inputMessage}
                    disabled={isSending || isStreaming}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isStreaming
                        ? `${session?.characterName || "AI"} đang trả lời...`
                        : `Nhập tin nhắn hoặc *hành động* đến ${session?.characterName}...`
                    }
                    className="max-h-36 min-h-[26px] flex-1 resize-none bg-transparent py-1 px-0 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar disabled:opacity-60"
                  />

                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStopGenerating}
                      className="flex h-8 px-2.5 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-red-900/60 hover:bg-red-800/80 border border-red-500/40 text-red-200 text-xs font-semibold transition-all mb-0.5 cursor-pointer active:scale-95 shadow-xs"
                      title="Dừng tạo phản hồi"
                    >
                      <Square className="h-3 w-3 fill-red-300 text-red-300" />
                      <span>Dừng</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isSending}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-150 mb-0.5 ${
                        inputMessage.trim() && !isSending
                          ? "bg-zinc-100 text-zinc-950 font-bold shadow-sm hover:bg-white active:scale-95 cursor-pointer"
                          : "bg-[#28292f] text-zinc-600 cursor-not-allowed opacity-40"
                      }`}
                      title="Gửi (Enter)"
                    >
                      {isSending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />
                      ) : (
                        <Send className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      )}
                    </button>
                  )}
                </form>
                <div className="mt-1 flex items-center justify-between px-2 text-[10px] text-zinc-500">
                  <span>
                    Hành động nhập vai đặt trong dấu{" "}
                    <span className="text-zinc-300 font-mono">*sao*</span>
                  </span>
                  <span className="hidden sm:inline text-zinc-500">
                    Enter gửi • Shift+Enter xuống dòng
                  </span>
                </div>
              </>
            )}
          </div>
        </footer>
      </div>

      {/* 3. RIGHT SIDEBAR: Hồ Sơ Nhân Vật & Hảo Cảm */}
      <CharacterProfileSidebar
        isOpen={showRightSidebar}
        session={session}
        currentStage={currentStage}
        affectionScore={affectionScore}
        onOpenAffectionModal={() => setShowAffectionModal(true)}
        character={character}
      />
      </div>

      {/* Rollback Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        onConfirm={handleConfirmRollback}
        title="Quay về mốc hội thoại này?"
        description="Toàn bộ diễn biến và tin nhắn sau mốc này sẽ được xóa để bạn có thể tiếp tục rẽ một nhánh cốt truyện mới."
        confirmText="Quay về mốc này"
        cancelText="Giữ nguyên"
        variant="warning"
        isLoading={isRollingBack}
      />

      {/* Floating Level Up Toast Notification */}
      {levelUpNotif && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-3xl border border-pink-500/50 bg-[#1e1f26]/95 px-5 py-3 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 slide-in-from-top-4 duration-300 pointer-events-none">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg">
            <Heart className="h-6 w-6 text-white fill-white animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                Độ Hảo Cảm Thăng Cấp!
              </span>
              <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-spin" />
            </div>
            <p className="text-sm font-extrabold text-white">
              Đạt cột mốc: <span className={levelUpNotif.color}>{levelUpNotif.name}</span> (
              {affectionScore}%)
            </p>
          </div>
        </div>
      )}

      {/* Relationship & Affection Modal */}
      <AffectionModal
        isOpen={showAffectionModal}
        onClose={() => setShowAffectionModal(false)}
        session={session}
        currentStage={currentStage}
        affectionScore={affectionScore}
        theme={theme}
        character={character}
      />
    </div>
  );
}
