import {
  ApiResponse,
  AuthResponse,
  Character,
  ChatSession,
  ChatSessionListItem,
  CreateCharacterRequest,
  LoginRequest,
  RegisterRequest,
  UpdateCharacterRequest,
  UpdateProfileRequest,
  GeneratedCharacterDto,
  SendMessageResponse,
  User,
  CharacterMemory,
  UserProfile,
  UpdateUserProfileRequest,
  ProactiveReachoutResponse,
  WorldGenre,
  CharacterVisualIdentity,
  TriggerSceneImageResponse,
  SceneImageStatusResponse,
} from "@/types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5010/api/v1";
const ACCOUNT_API_BASE_URL = process.env.NEXT_PUBLIC_ACCOUNT_API_URL || "http://localhost:5000/api/v1";

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  if (url.startsWith("/api/test-scene")) {
    return url;
  }
  const backendHost = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5010/api/v1").replace(/\/api\/v1\/?$/, "");
  if (url.startsWith("/")) {
    return `${backendHost}${url}`;
  }
  return `${backendHost}/${url}`;
}

export function getAuthHeader(): Record<string, string> {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    const token = localStorage.getItem("nyxoris_auth_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

function mapAccountUserToUser(data: Record<string, unknown> | null | undefined): User {
  const obj = data || {};
  const item = (typeof obj.data === "object" && obj.data !== null
    ? obj.data
    : typeof obj.value === "object" && obj.value !== null
    ? obj.value
    : obj) as Record<string, unknown>;

  return {
    id: String(item.userId || item.id || ""),
    email: String(item.email || ""),
    userName: String(item.username || item.userName || ""),
    displayName: String(item.displayName || item.username || "User"),
    avatarUrl: String(item.avatarUrl || ""),
    createdAt: String(item.createdAt || new Date().toISOString()),
  };
}

export function extractErrorMessage(errorJson: Record<string, unknown> | null | undefined): string | undefined {
  if (!errorJson) return undefined;
  if (Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
    return String(errorJson.errors[0]);
  }
  if (errorJson.errors && typeof errorJson.errors === "object") {
    const values = Object.values(errorJson.errors).flat();
    if (values.length > 0) return String(values[0]);
  }
  return typeof errorJson.message === "string"
    ? errorJson.message
    : typeof errorJson.title === "string"
    ? errorJson.title
    : undefined;
}

export function localizeError(rawError: string | undefined, defaultMessage: string): string {
  if (!rawError) return defaultMessage;
  const lower = rawError.toLowerCase();

  if (lower.includes("email is already in use") || lower.includes("already in use") || lower.includes("conflict")) {
    return "Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.";
  }
  if (lower.includes("invalid email or password") || lower.includes("unauthorized") || lower.includes("invalid_credentials")) {
    return "Email hoặc mật khẩu không chính xác. Vui lòng thử lại!";
  }
  if (lower.includes("character") && lower.includes("not found")) {
    return "Không tìm thấy thông tin nhân vật này.";
  }
  if (lower.includes("session") && lower.includes("not found")) {
    return "Không tìm thấy phòng trò chuyện này.";
  }
  if (lower.includes("failed to send message") || lower.includes("ai")) {
    return "Không thể nhận phản hồi từ AI. Vui lòng thử lại!";
  }

  return rawError.includes("failed") || rawError.includes("error") || rawError.includes("validation") ? defaultMessage : rawError;
}

export async function loginUser(req: LoginRequest): Promise<AuthResponse> {
  const res = await fetch(`${ACCOUNT_API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Email hoặc mật khẩu không chính xác. Vui lòng thử lại!"));
  }
  const json = await res.json();
  const token = json?.token || json?.data?.token;
  const user = mapAccountUserToUser(json);
  return { token, user };
}

export async function registerUser(req: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch(`${ACCOUNT_API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: req.email,
      password: req.password,
      userName: req.userName || undefined,
      displayName: req.displayName || undefined,
    }),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Đăng ký không thành công. Vui lòng thử lại!"));
  }
  const json = await res.json();
  const token = json?.token || json?.data?.token;
  const user = mapAccountUserToUser(json);
  return { token, user };
}

export async function updateAuthProfile(req: UpdateProfileRequest): Promise<User> {
  const res = await fetch(`${ACCOUNT_API_BASE_URL}/profile/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      displayName: req.displayName || undefined,
      avatarUrl: req.avatarUrl || undefined,
    }),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể cập nhật hồ sơ. Vui lòng thử lại!"));
  }
  const json = await res.json();
  return mapAccountUserToUser(json);
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader.Authorization) return null;

    const res = await fetch(`${ACCOUNT_API_BASE_URL}/profile/me`, {
      headers: { ...authHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("nyxoris_auth_token");
        }
      }
      return null;
    }
    const json = await res.json();
    return mapAccountUserToUser(json);
  } catch (error) {
    console.warn("[API] Could not fetch current user:", error);
    return null;
  }
}

export async function fetchCharacters(category?: string): Promise<Character[]> {
  try {
    const url = category
      ? `${API_BASE_URL}/characters?category=${encodeURIComponent(category)}`
      : `${API_BASE_URL}/characters`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch characters, status: ${res.status}`);
      return [];
    }
    const json: ApiResponse<Character[]> = await res.json();
    return json.data || [];
  } catch (error) {
    console.warn("[API] Backend is unreachable or returned error:", error);
    return [];
  }
}

export async function fetchMyCharacters(): Promise<Character[]> {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader.Authorization) return [];

    const res = await fetch(`${API_BASE_URL}/characters/mine`, {
      headers: { ...authHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[API] Failed to fetch my characters, status: ${res.status}`);
      return [];
    }
    const json: ApiResponse<Character[]> = await res.json();
    return json.data || [];
  } catch (error) {
    console.warn("[API] Could not fetch my characters:", error);
    return [];
  }
}

export async function fetchCharacterById(id: string): Promise<Character | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/characters/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json: ApiResponse<Character> = await res.json();
    return json.data || null;
  } catch (error) {
    console.warn(`[API] Could not fetch character ${id}:`, error);
    return null;
  }
}

export async function createCharacter(req: CreateCharacterRequest): Promise<Character> {
  const res = await fetch(`${API_BASE_URL}/characters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể tạo nhân vật mới. Vui lòng thử lại!"));
  }
  const json: ApiResponse<Character> = await res.json();
  return json.data;
}

export async function updateCharacter(id: string, req: UpdateCharacterRequest): Promise<Character> {
  const res = await fetch(`${API_BASE_URL}/characters/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể cập nhật nhân vật. Vui lòng thử lại!"));
  }
  const json: ApiResponse<Character> = await res.json();
  return json.data;
}

export async function deleteCharacter(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/characters/${id}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeader(),
    },
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể xóa nhân vật. Vui lòng thử lại!"));
  }
  return true;
}

export async function fetchRecentSessions(): Promise<ChatSessionListItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/sessions`, {
      headers: { ...getAuthHeader() },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json: ApiResponse<ChatSessionListItem[]> = await res.json();
    return json.data || [];
  } catch (error) {
    console.warn("[API] Could not fetch chat sessions:", error);
    return [];
  }
}

export async function createChatSession(characterId: string, title: string): Promise<ChatSession> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ characterId, title }),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể khởi tạo phòng trò chuyện. Vui lòng thử lại!"));
  }
  const json: ApiResponse<ChatSession> = await res.json();
  return json.data;
}

export async function getOrCreateChatSession(characterId: string, title?: string): Promise<{ id: string }> {
  try {
    const sessions = await fetchRecentSessions();
    const existing = sessions.find((s) => s.characterId === characterId);
    if (existing) {
      return { id: existing.id };
    }
  } catch (err) {
    console.warn("[API] Could not check existing sessions:", err);
  }
  return await createChatSession(characterId, title || "Cuộc trò chuyện");
}

export async function fetchChatSession(sessionId: string): Promise<ChatSession> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`, {
    headers: { ...getAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không tìm thấy phòng trò chuyện này."));
  }
  const json: ApiResponse<ChatSession> = await res.json();
  return json.data;
}

export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể xóa phòng trò chuyện này."));
  }
  return true;
}

export async function sendChatMessage(
  sessionId: string,
  content: string
): Promise<SendMessageResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ sessionId, content }),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể nhận phản hồi từ AI. Vui lòng thử lại!"));
  }
  const json = await res.json();
  return json.data;
}

export async function rollbackChatMessage(
  sessionId: string,
  messageId: string
): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/rollback/${messageId}`, {
    method: "POST",
    headers: {
      ...getAuthHeader(),
    },
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể quay về mốc tin nhắn này."));
  }
  return true;
}

export async function fetchRoleplaySuggestions(sessionId: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/suggestions`, {
      headers: { ...getAuthHeader() },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json?.data ?? json?.value ?? json;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Could not fetch roleplay suggestions:", err);
    return [];
  }
}

export async function generateCharacterWithAI(
  idea: string,
  category?: string,
  visualStyle?: string
): Promise<GeneratedCharacterDto> {
  const res = await fetch(`${API_BASE_URL}/characters/generate-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ idea, category, visualStyle }),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể tự động tạo nhân vật bằng AI lúc này. Vui lòng thử lại!"));
  }
  const json = await res.json();
  const data = json?.data ?? json?.value ?? json;
  if (!data) {
    throw new Error("Không nhận được dữ liệu hợp lệ từ AI.");
  }
  return data;
}

export const generateCharacterWithAi = generateCharacterWithAI;

export async function fetchAIRandomIdeas(count = 3): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/characters/generate-ideas?count=${count}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json?.data ?? json?.value ?? json;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Could not fetch AI random ideas:", err);
    return [];
  }
}

export const fetchAiRandomIdeas = fetchAIRandomIdeas;

export async function generateCharacterAvatar(req: {
  name?: string;
  title?: string;
  category?: string;
  personalityPrompt?: string;
  idea?: string;
  worldGenre?: WorldGenre | number;
  visualIdentity?: CharacterVisualIdentity;
}): Promise<{ avatarUrl: string; fullBodyUrl?: string; prompt: string }> {
  const res = await fetch(`${API_BASE_URL}/characters/generate-avatar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể vẽ ảnh đại diện bằng AI lúc này. Vui lòng thử lại!"));
  }
  const json = await res.json();
  const data = json?.data ?? json?.value ?? json;
  const rawAvatarUrl = data?.avatarUrl || data?.imageUrl || data?.url;
  const rawFullBodyUrl = data?.fullBodyUrl || data?.canonicalReferenceUrl || undefined;
  const avatarUrl = resolveMediaUrl(rawAvatarUrl);
  const fullBodyUrl = rawFullBodyUrl ? resolveMediaUrl(rawFullBodyUrl) : undefined;
  const prompt = data?.prompt || data?.revisedPrompt || "";
  if (!data || !avatarUrl) {
    throw new Error("Không nhận được ảnh đại diện từ AI.");
  }
  return { avatarUrl, fullBodyUrl, prompt };
}

export async function generateCharacterStandee(req: {
  name?: string;
  title?: string;
  category?: string;
  personalityPrompt?: string;
  idea?: string;
  worldGenre?: WorldGenre | number;
  visualIdentity?: CharacterVisualIdentity;
  referenceImageUrl?: string;
  avatarUrl?: string;
  bodyReferenceUrl?: string;
}): Promise<{ standeeUrl: string; prompt: string }> {
  const res = await fetch(`${API_BASE_URL}/characters/generate-standee`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể vẽ ảnh dáng đứng bằng AI lúc này. Vui lòng thử lại!"));
  }
  const json = await res.json();
  const data = json?.data ?? json?.value ?? json;
  const rawStandeeUrl = data?.standeeUrl || data?.imageUrl || data?.fullBodyUrl || data?.url;
  const standeeUrl = resolveMediaUrl(rawStandeeUrl);
  const prompt = data?.revisedPrompt || data?.prompt || "";
  if (!data || !standeeUrl) {
    throw new Error("Không nhận được ảnh dáng đứng từ AI.");
  }
  return { standeeUrl, prompt };
}

export async function triggerTurnSceneImage(
  sessionId: string,
  turnId: string
): Promise<TriggerSceneImageResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/turns/${turnId}/image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể kích hoạt vẽ hình ảnh cho lượt này. Vui lòng thử lại!"));
  }
  const json: ApiResponse<TriggerSceneImageResponse> = await res.json();
  return json.data;
}

export async function getSceneImageStatus(
  generationRequestId: string
): Promise<SceneImageStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/scene-images/${generationRequestId}`, {
    headers: {
      ...getAuthHeader(),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể lấy trạng thái hình ảnh."));
  }
  const json: ApiResponse<SceneImageStatusResponse> = await res.json();
  const statusData = json.data;
  if (statusData && statusData.imageUrl) {
    statusData.imageUrl = resolveMediaUrl(statusData.imageUrl);
  }
  return statusData;
}

export interface GenerateSceneImagePayload {
  sessionId?: string;
  characterName?: string;
  characterTitle?: string;
  characterPersonality?: string;
  messageContent: string;
  userMessageContent?: string;
  referenceImageUrl?: string;
  visualIdentity?: CharacterVisualIdentity;
  worldDescription?: string;
  sceneState?: {
    currentLocation?: string;
    currentPosition?: string;
    currentOutfit?: string;
    currentTimeOfDay?: string;
    heldItems?: string;
    atmosphere?: string;
  };
}

export async function generateSceneImage(
  req: GenerateSceneImagePayload
): Promise<{ imageUrl: string; prompt: string }> {
  const res = await fetch(`${API_BASE_URL}/chat/imagine-scene`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể phác họa khoảnh khắc này. Vui lòng thử lại!"));
  }
  const json = await res.json();
  const data = json?.data ?? json?.value ?? json;
  const rawImageUrl = data?.imageUrl || data?.avatarUrl || data?.url;
  if (!data || !rawImageUrl) {
    throw new Error("Không nhận được hình ảnh minh họa từ AI.");
  }
  return { imageUrl: resolveMediaUrl(rawImageUrl), prompt: data.prompt || "" };
}

export async function fetchCharacterMemories(characterId: string, limit: number = 30): Promise<CharacterMemory[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/memories/${characterId}?limit=${limit}`, {
      headers: {
        ...getAuthHeader(),
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data || json?.value || [];
  } catch (error) {
    console.warn(`[API] Could not fetch memories for character ${characterId}:`, error);
    return [];
  }
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/user-profile/${userId}`, {
    headers: {
      ...getAuthHeader(),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Không thể tải hồ sơ người dùng.");
  }
  const json = await res.json();
  return json?.data || json?.value || json;
}

export async function updateUserProfile(userId: string, req: UpdateUserProfileRequest): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/user-profile/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      bio: req.bio,
      interests: req.interests,
      personalityTraits: req.personalityTraits,
      statusMessage: req.statusMessage,
    }),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể cập nhật hồ sơ người dùng."));
  }
  const json = await res.json();
  return json?.data || json?.value || json;
}

export async function proactiveReachout(req: { characterId: string; userId: string }): Promise<ProactiveReachoutResponse> {
  const res = await fetch(`${API_BASE_URL}/chat/proactive-reachout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    const rawError = extractErrorMessage(errorJson);
    throw new Error(localizeError(rawError, "Không thể kích hoạt tin nhắn làm quen từ nhân vật."));
  }
  const json = await res.json();
  return json?.data || json?.value || json;
}

// ==========================================
// SSE Streaming Client Re-exports
// ==========================================
export {
  streamChatMessage,
  getDefaultErrorMessageForStatus,
  isAbortError,
  generateUUID,
  dispatchSseEvent,
} from "./api/chatStream";
export type {
  StreamTokenEvent,
  StreamMetadataEvent,
  StreamEventUnlockedEvent,
  StreamDoneEvent,
  StreamErrorEvent,
  ChatStreamEvent,
  StreamChatOptions,
} from "./api/chatStream";
export {
  createSseParser,
  safeJsonParse,
} from "./api/sseParser";
export type {
  SseRawEvent,
  SseParserCallbacks,
  SseParser,
  SafeJsonParseResult,
} from "./api/sseParser";

