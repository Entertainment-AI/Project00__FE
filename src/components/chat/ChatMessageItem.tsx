"use client";

import React from "react";
import {
  Sparkles,
  Undo2,
  Lightbulb,
  FastForward,
  RotateCcw,
  Check,
  Copy,
  Loader2,
  Eye,
  Hand,
  HeartPulse,
  Footprints,
  Moon,
  Package,
  Wand2,
  Swords,
  Volume2,
  ShieldAlert,
  Clock,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessage, ChatSession } from "@/types";
import { ThemeConfig } from "./chat.constants";
import { resolveMediaUrl } from "@/lib/api";

interface ChatMessageItemProps {
  msg: ChatMessage;
  index: number;
  isUser: boolean;
  isOpeningMessage: boolean;
  isLatestAI: boolean;
  canRollback: boolean;
  theme: ThemeConfig;
  session: ChatSession | null;
  userAvatarUrl?: string;
  userName?: string;
  copiedId: string | null;
  isSending: boolean;
  isRollingBack: boolean;
  isLoadingSuggestions: boolean;
  isImagining?: boolean;
  sceneImageUrl?: string;
  sceneImageStatus?: "idle" | "queued" | "pending" | "processing" | "completed" | "failed" | "timeout" | "cancelled";
  sceneImageFailureReason?: string;
  onCopy: (id: string, text: string) => void;
  onRollback: (id: string, index: number) => void;
  onFetchSuggestions: () => void;
  onContinueStory: () => void;
  onRegenerate: () => void;
  onImagineScene?: (turnId: string) => void;
  onRegenerateScene?: (turnId: string) => void;
  onCancelScene?: (turnId: string) => void;
}

export function formatSceneImageError(rawReason?: string, status?: string): string {
  if (status === "cancelled") {
    return "Yêu cầu vẽ ảnh đã được hủy.";
  }
  if (status === "timeout") {
    return "Hết thời gian chờ phản hồi từ máy chủ AI. Bạn hãy thử lại nhé.";
  }
  if (!rawReason) {
    return "Không thể tạo ảnh cho khoảnh khắc này. Vui lòng thử lại.";
  }

  const lower = rawReason.toLowerCase();
  if (
    lower.includes("actively refused") ||
    lower.includes("failed to communicate with comfyui") ||
    lower.includes("connection refused") ||
    lower.includes("socketexception") ||
    lower.includes("httprequestexception") ||
    lower.includes("no such host") ||
    lower.includes("127.0.0.1:8188")
  ) {
    return "Máy chủ vẽ ảnh AI tạm thời chưa sẵn sàng hoặc chưa được khởi động. Vui lòng thử lại sau.";
  }

  if (lower.includes("reference image") || lower.includes("visual identity")) {
    return "Chưa có ảnh chân dung mẫu phù hợp để phác họa nhân vật này.";
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("canceled")) {
    return "Quá trình tạo ảnh mất nhiều thời gian hơn dự kiến. Vui lòng bấm thử lại.";
  }

  if (lower.includes("workflow") || lower.includes("model") || lower.includes("gpu")) {
    return "Mô hình vẽ ảnh đang bận hoặc đang bảo trì. Vui lòng thử lại sau.";
  }

  if (rawReason.length < 80 && !rawReason.includes("Exception") && !rawReason.includes("{") && !rawReason.includes("at ")) {
    return rawReason;
  }

  return "Không thể tạo ảnh cho khoảnh khắc này. Vui lòng thử lại.";
}

export const getActionMeta = (actionText: string, colorClass: string) => {
  const tagMatch = actionText.match(/^\[([a-zA-Z0-9_-]+)\]/);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : null;

  if (tag === "gaze") {
    return { icon: <Eye className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Ánh mắt" };
  }
  if (tag === "touch") {
    return { icon: <Hand className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Cử chỉ" };
  }
  if (tag === "emotion") {
    return { icon: <HeartPulse className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Cảm xúc" };
  }
  if (tag === "move") {
    return { icon: <Footprints className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Di chuyển" };
  }
  if (tag === "scene") {
    return { icon: <Moon className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Bối cảnh" };
  }
  if (tag === "item") {
    return { icon: <Package className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Vật phẩm" };
  }
  if (tag === "magic") {
    return { icon: <Wand2 className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Ma thuật" };
  }
  if (tag === "combat") {
    return { icon: <Swords className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Chiến đấu" };
  }
  if (tag === "whisper") {
    return { icon: <Volume2 className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Thì thầm" };
  }
  if (tag === "action") {
    return { icon: <Sparkles className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Hành động" };
  }

  const lower = actionText.toLowerCase();
  if (/nhìn|ngắm|mắt|ánh mắt|chớp mắt|cau mày|nhướng mày|liếc|mỉm cười|cười|nhếch mép|khuôn mặt|gương mặt|quan sát|dõi theo|hướng mắt|ngước nhìn|chăm chú/.test(lower)) {
    return { icon: <Eye className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Ánh mắt" };
  }
  if (/tay|bàn tay|ngón tay|chạm|nắm|vuốt|xoa|kéo|ôm|siết|đan|áp|buông|vỗ|choàng|khoác|đỡ|với lấy/.test(lower)) {
    return { icon: <Hand className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Cử chỉ" };
  }
  if (/tim|nhịp tim|lồng ngực|thở|hơi thở|thở dài|đỏ mặt|run rẩy|ngại ngùng|ấm áp|lạnh lẽo|ngập ngừng|xao xuyến/.test(lower)) {
    return { icon: <HeartPulse className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Cảm xúc" };
  }
  if (/bước|đi|tiến|lùi|chạy|quay người|đứng dậy|ngồi xuống|dời|tiếp cận|lướt|rời đi|tiến lại/.test(lower)) {
    return { icon: <Footprints className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Di chuyển" };
  }
  if (/gió|mưa|ánh trăng|trăng|bóng tối|không gian|khung cảnh|bầu trời|sương mù|bóng đêm|căn phòng|yên ắng|tĩnh mịch|thời tiết/.test(lower)) {
    return { icon: <Moon className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Bối cảnh" };
  }
  if (/trà|rượu|quà|bức thư|chìa khóa|vật phẩm|cuốn sách|cốc|ly|chén|áo khoác|khăn|giao cho|đưa cho|mở hộp/.test(lower)) {
    return { icon: <Package className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Vật phẩm" };
  }
  if (/phép|ma pháp|ma thuật|trượng|linh lực|tỏa sáng|bùng cháy|phát sáng|hào quang|kết giới/.test(lower)) {
    return { icon: <Wand2 className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Ma thuật" };
  }
  if (/kiếm|dao|vũ khí|tấn công|đỡ|vung|chém|bắn|phòng thủ|rút kiếm/.test(lower)) {
    return { icon: <Swords className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Chiến đấu" };
  }
  if (/thì thầm|khẽ nói|nói nhỏ|thốt lên|khúc khích|tiếng cười|thì thào/.test(lower)) {
    return { icon: <Volume2 className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Thì thầm" };
  }
  return { icon: <Sparkles className={`h-3.5 w-3.5 ${colorClass} shrink-0`} />, label: "Hành động" };
};

export const formatMessageContent = (content: string, theme: ThemeConfig) => {
  const parts = content.split(/(💭\s*\*?[^*]+\*?|\*[^*]+\*)/g).filter(Boolean);

  return (
    <div className="space-y-2.5">
      {parts.map((part, pIdx) => {
        const trimmed = part.trim();
        if (!trimmed) return null;

        const isThought = trimmed.startsWith("💭");
        const isAction = !isThought && trimmed.startsWith("*") && trimmed.endsWith("*");

        if (isThought) {
          const thoughtText = trimmed.replace(/^💭\s*\*?/, "").replace(/\*?$/, "").trim();
          if (!thoughtText) return null;

          return (
            <div
              key={pIdx}
              className={`my-2 rounded-2xl border ${theme.thoughtBorder} bg-gradient-to-br ${theme.thoughtGradient} p-3 shadow-inner backdrop-blur-sm`}
            >
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${theme.thoughtHeader} mb-1`}>
                <span className="text-sm">💭</span>
                <span className="tracking-wide">Tâm tư thầm kín</span>
              </div>
              <p className={`italic ${theme.thoughtText} text-[13px] leading-relaxed font-normal pl-1`}>
                &quot;{thoughtText}&quot;
              </p>
            </div>
          );
        }

        if (isAction) {
          const rawActionText = trimmed.slice(1, -1).trim();
          if (!rawActionText) return null;

          const actionMeta = getActionMeta(rawActionText, theme.actionStar);
          const displayText = rawActionText.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, "").trim();

          return (
            <div
              key={pIdx}
              className={`my-2 rounded-2xl border-l-2 ${theme.actionBorder} bg-[#15191e]/90 p-3 shadow-inner backdrop-blur-sm`}
            >
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${theme.thoughtHeader} mb-1`}>
                {actionMeta.icon}
                <span className="tracking-wide">{actionMeta.label}</span>
              </div>
              <p className="italic text-zinc-300 font-normal leading-relaxed text-[13px] pl-0.5">
                &quot;{displayText}&quot;
              </p>
            </div>
          );
        }

        return (
          <div
            key={pIdx}
            className="text-zinc-100 font-medium text-[14.5px] px-1 py-0.5 leading-relaxed"
          >
            {trimmed}
          </div>
        );
      })}
    </div>
  );
};

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  msg,
  index,
  isUser,
  isOpeningMessage,
  isLatestAI,
  canRollback,
  theme,
  session,
  userAvatarUrl,
  userName,
  copiedId,
  isSending,
  isRollingBack,
  isLoadingSuggestions,
  isImagining = false,
  sceneImageUrl,
  sceneImageStatus = "idle",
  sceneImageFailureReason,
  onCopy,
  onRollback,
  onFetchSuggestions,
  onContinueStory,
  onRegenerate,
  onImagineScene,
  onRegenerateScene,
  onCancelScene,
}) => {
  const effectiveTurnId = msg.turnId || undefined;
  const isGeneratingThisTurn =
    isImagining ||
    sceneImageStatus === "queued" ||
    sceneImageStatus === "pending" ||
    sceneImageStatus === "processing";

  return (
    <div
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      } animate-in fade-in slide-in-from-bottom-1 duration-200`}
    >
      <div
        className={`flex max-w-[88%] sm:max-w-[80%] items-start gap-3 ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {!isUser && (
          <Avatar
            src={session?.characterAvatar}
            alt={session?.characterName || "AI"}
            size="md"
            type="character"
            className="!rounded-2xl border border-[#3b3d46] shrink-0 mt-0.5 shadow-md"
          />
        )}
        {isUser && (
          <Avatar
            src={userAvatarUrl}
            alt={userName || "Bạn"}
            size="sm"
            type="user"
            className="!rounded-full border border-[#3b3d46] shrink-0"
          />
        )}

        <div
          className={`relative rounded-3xl p-4 sm:p-5 text-sm shadow-md leading-relaxed transition-all ${
            isUser
              ? "bg-[#2b2d35] text-white rounded-tr-xs border border-[#3b3d46]"
              : "bg-[#212227] text-zinc-200 rounded-tl-xs border border-[#31333a]"
          }`}
        >
          {isOpeningMessage && (
            <div
              className={`flex items-center gap-1.5 mb-2.5 pb-2 border-b border-[#2c2e35] text-[11px] font-bold ${theme.badgeText}`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${theme.badgeIcon}`} />
              <span className="uppercase tracking-wider">Cốt Truyện Mở Đầu</span>
            </div>
          )}

          <div>
            {msg.content ? (
              formatMessageContent(msg.content, theme)
            ) : msg.isStreaming ? (
              <div className="flex items-center gap-2 py-1 text-zinc-400 text-xs italic">
                <span className="inline-block h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
                <span>Đang suy nghĩ...</span>
              </div>
            ) : null}
            {msg.isStreaming && msg.content && (
              <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-zinc-300 animate-pulse rounded-xs" />
            )}
          </div>

          {/* 1. In-Flight Initial Generation (when no prior image exists) */}
          {isGeneratingThisTurn && !sceneImageUrl && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#383a45] bg-[#16171b] p-5 shadow-lg relative flex flex-col items-center justify-center text-center gap-3 min-h-[145px]">
              <div className="relative flex items-center justify-center">
                <div className="h-9 w-9 rounded-xl bg-[#252730] border border-[#3b3d46] flex items-center justify-center shadow-xs">
                  <Loader2 className="h-4.5 w-4.5 text-zinc-300 animate-spin" />
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-zinc-200">
                  {sceneImageStatus === "queued" ? "Đang chuẩn bị khung cảnh..." : "Đang phác họa khoảnh khắc..."}
                </p>
                <p className="text-[11px] text-zinc-400">
                  AI đang tái hiện cảm xúc và bối cảnh của nhân vật
                </p>
              </div>
              <div className="w-32 h-1 rounded-full bg-[#252730] overflow-hidden border border-[#31333a]">
                <div className="h-full w-full bg-gradient-to-r from-zinc-500 via-zinc-300 to-zinc-500 animate-pulse" />
              </div>

              {onCancelScene && effectiveTurnId && (
                <button
                  type="button"
                  onClick={() => onCancelScene(effectiveTurnId)}
                  className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-[#252730]/80 hover:bg-[#2c2f3a] border border-[#383a45] rounded-lg px-2.5 py-1 transition-all cursor-pointer active:scale-95 shadow-xs"
                >
                  <X className="h-3 w-3 text-zinc-400" />
                  <span>Hủy yêu cầu</span>
                </button>
              )}
            </div>
          )}

          {/* 2. Scene Illustration Image (Completed or with In-Flight Regeneration Overlay) */}
          {sceneImageUrl && (
            <div className="mt-3 space-y-2">
              <div className="overflow-hidden rounded-2xl border border-[#3b3d46] bg-[#121316] shadow-xl group relative">
                <img
                  src={resolveMediaUrl(sceneImageUrl)}
                  alt="Minh họa khoảnh khắc"
                  className="w-full h-auto max-h-[420px] object-cover transition-transform duration-300 group-hover:scale-102"
                />

                {/* Regeneration In-Flight Overlay */}
                {isGeneratingThisTurn && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 p-4 z-10">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18191e]/90 border border-[#383a45] shadow-lg text-zinc-200 text-xs font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />
                      <span>{sceneImageStatus === "queued" ? "Đang chuẩn bị bản vẽ mới..." : "Đang phác họa bản vẽ mới..."}</span>
                    </div>
                    {onCancelScene && effectiveTurnId && (
                      <button
                        type="button"
                        onClick={() => onCancelScene(effectiveTurnId)}
                        className="flex items-center gap-1 text-[11px] font-medium text-zinc-300 hover:text-white bg-[#252730]/90 hover:bg-[#2c2f3a] border border-[#383a45] rounded-lg px-2.5 py-1 transition-all cursor-pointer active:scale-95 shadow-md"
                      >
                        <X className="h-3 w-3 text-zinc-400" />
                        <span>Hủy vẽ lại</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Regenerate Action Button */}
                {!isGeneratingThisTurn && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {onRegenerateScene && effectiveTurnId && (
                      <button
                        type="button"
                        onClick={() => onRegenerateScene(effectiveTurnId)}
                        disabled={isSending || isGeneratingThisTurn}
                        className="rounded-lg bg-black/75 hover:bg-black/90 backdrop-blur-xs px-2.5 py-1 text-[11px] text-zinc-200 font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        title="Vẽ lại khoảnh khắc này với snapshot cố định"
                      >
                        <RotateCcw className="h-3 w-3 text-amber-400" />
                        <span>Vẽ lại</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="absolute bottom-2 right-2 rounded-lg bg-black/70 backdrop-blur-xs px-2.5 py-1 text-[10px] text-zinc-200 font-semibold flex items-center gap-1.5 shadow-md z-10">
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  <span>Khoảnh khắc AI</span>
                </div>
              </div>

              {/* Notice if a regeneration attempt failed or was cancelled */}
              {!isGeneratingThisTurn && (sceneImageStatus === "failed" || sceneImageStatus === "timeout" || sceneImageStatus === "cancelled") && (
                <div className="overflow-hidden rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs flex items-center justify-between gap-2">
                  <span className="text-red-300">
                    {sceneImageStatus === "cancelled"
                      ? "Lần vẽ lại gần nhất đã bị hủy (đã giữ lại bản vẽ trước)."
                      : `Lần vẽ lại không thành công: ${formatSceneImageError(sceneImageFailureReason, sceneImageStatus)} (đã giữ lại bản vẽ trước).`}
                  </span>
                  {onImagineScene && effectiveTurnId && (
                    <button
                      type="button"
                      onClick={() => onImagineScene(effectiveTurnId)}
                      disabled={isSending || isGeneratingThisTurn}
                      className="shrink-0 rounded bg-red-900/50 hover:bg-red-900/80 px-2 py-0.5 text-[10px] font-semibold text-red-200 cursor-pointer"
                    >
                      Thử lại
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Failed / Cancelled Scene Generation (when no prior image exists) */}
          {!isGeneratingThisTurn && !sceneImageUrl && (sceneImageStatus === "failed" || sceneImageStatus === "cancelled") && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-red-500/30 bg-red-950/20 p-3 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                  <span className="text-xs text-red-300 font-medium leading-relaxed">
                    {formatSceneImageError(sceneImageFailureReason, sceneImageStatus)}
                  </span>
                </div>
                {onImagineScene && effectiveTurnId && (
                  <button
                    type="button"
                    onClick={() => onImagineScene(effectiveTurnId)}
                    disabled={isSending || isGeneratingThisTurn}
                    className="shrink-0 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-500/40 px-3 py-1.5 text-[11px] font-semibold text-red-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. Polling Timeout / Latency Warning */}
          {!isGeneratingThisTurn && !sceneImageUrl && sceneImageStatus === "timeout" && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-300 font-medium leading-relaxed">
                    {sceneImageFailureReason || "Hết thời gian chờ phản hồi từ máy chủ."}
                  </span>
                </div>
                {onImagineScene && effectiveTurnId && (
                  <button
                    type="button"
                    onClick={() => onImagineScene(effectiveTurnId)}
                    disabled={isSending || isGeneratingThisTurn}
                    className="shrink-0 rounded-lg bg-amber-900/40 hover:bg-amber-900/60 border border-amber-500/40 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-4 pt-2 border-t border-[#2c2e35]/60 text-[10px] text-zinc-500">
            <span className="shrink-0 font-mono tracking-tight text-zinc-400">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              {msg.isStreaming ? (
                <span className="text-[11px] text-zinc-400 italic flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-ping" />
                  Đang phản hồi...
                </span>
              ) : (
                <>
                  {canRollback && (
                    <button
                      type="button"
                      onClick={() => onRollback(msg.id, index)}
                      disabled={isSending || isRollingBack}
                      className="flex items-center gap-1.5 rounded-lg bg-[#272832] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#323440] hover:text-amber-300 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                      title="Quay về mốc hội thoại này (Xóa tin nhắn phía sau để rẽ nhánh mới)"
                    >
                      <Undo2 className="h-3 w-3 text-amber-400" />
                      <span>Quay về đây</span>
                    </button>
                  )}

                  {!isUser && !isOpeningMessage && onImagineScene && effectiveTurnId && !sceneImageUrl && !isGeneratingThisTurn && (
                    <button
                      type="button"
                      onClick={() => onImagineScene(effectiveTurnId)}
                      disabled={isSending || isGeneratingThisTurn}
                      className="flex items-center gap-1.5 rounded-lg bg-[#272832] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#323440] hover:text-purple-300 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                      title="AI vẽ lại khoảnh khắc nhân vật trong câu thoại này"
                    >
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      <span>Vẽ cảnh</span>
                    </button>
                  )}

                  {isLatestAI && (
                    <>
                      <button
                        type="button"
                        onClick={onFetchSuggestions}
                        disabled={isSending || isLoadingSuggestions}
                        className="flex items-center gap-1.5 rounded-lg bg-[#272832] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#323440] hover:text-amber-300 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                        title="AI gợi ý 3 hướng phản hồi tiếp theo"
                      >
                        {isLoadingSuggestions ? (
                          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                        ) : (
                          <Lightbulb className="h-3 w-3 text-amber-400" />
                        )}
                        <span>Gợi ý</span>
                      </button>

                      <button
                        type="button"
                        onClick={onContinueStory}
                        disabled={isSending}
                        className="flex items-center gap-1.5 rounded-lg bg-[#272832] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#323440] hover:text-cyan-300 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                        title="Tiếp tục cốt truyện / AI tự hành động tiếp"
                      >
                        <FastForward className="h-3 w-3 text-cyan-400" />
                        <span>Tiếp tục</span>
                      </button>

                      <button
                        type="button"
                        onClick={onRegenerate}
                        disabled={isSending}
                        className="flex items-center gap-1.5 rounded-lg bg-[#272832] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-[#323440] hover:text-amber-300 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                        title="Tạo lại phản hồi khác cho lượt này"
                      >
                        <RotateCcw className="h-3 w-3 text-amber-400" />
                        <span>Tạo mới</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => onCopy(msg.id, msg.content)}
                    className="flex items-center gap-1 rounded-lg p-1.5 text-zinc-400 hover:bg-[#272832] hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Sao chép văn bản"
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
