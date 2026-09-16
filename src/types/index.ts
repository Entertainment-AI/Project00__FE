export interface User {
  id: string;
  email: string;
  userName: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
  lastUserNameChangedAt?: string | null;
  canChangeUserName?: boolean;
  nextUserNameChangeDate?: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  userName?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatarUrl?: string;
  userName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AccountAuthResponseDto {
  token: string;
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role?: string;
  isEmailVerified?: boolean;
}

export interface AccountProfileDto {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  dateOfBirth?: string | null;
  gender?: number | null;
  isEmailVerified?: boolean;
  role?: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  interests: string[];
  personalityTraits: string[];
  statusMessage?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UpdateUserProfileRequest {
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  interests?: string[];
  personalityTraits?: string[];
  statusMessage?: string | null;
}

export enum WorldGenre {
  Custom = 0,
  MundaneSliceOfLife = 1,
  HighFantasy = 2,
  UrbanSupernatural = 3,
  CyberpunkSciFi = 4,
  Historical = 5,
}

export interface RelationshipMilestone {
  name: string;
  minScore: number;
  maxScore: number;
  description: string;
  icon?: string;
}

export interface PsychologyProfile {
  desires?: string;
  fears?: string;
  insecurities?: string;
  coreBeliefs?: string;
  internalConflicts?: string;
  values?: string;
}

export interface BehaviorProfile {
  whenHappy?: string;
  whenSad?: string;
  whenAngry?: string;
  whenTeased?: string;
  whenPraised?: string;
  whenRejected?: string;
}

export interface ExpressionProfile {
  speechStyle?: string;
  formality?: string;
  humorStyle?: string;
  emojiUsage?: string;
  typicalPhrases?: string[];
}

export interface CharacterRules {
  mustDo?: string[];
  mustNotDo?: string[];
  antiSycophancy?: string;
  boundaries?: string[];
}

export interface CharacterBlueprint {
  psychology?: PsychologyProfile;
  behavior?: BehaviorProfile;
  expression?: ExpressionProfile;
  rules?: CharacterRules;
}

export interface CharacterVisualIdentity {
  gender?: string;
  face?: string;
  hair?: string;
  eyes?: string;
  skin?: string;
  body?: string;
  ageAppearance?: string;
  clothingStyle?: string;
  accessories?: string;
  visualTraits?: string;
  canonicalReferenceUrl?: string;
  fullBodyUrl?: string;
  style?: string;
  visualStyle?: string;
}

export interface CharacterVoiceProfile {
  voiceId: string;
  language?: string;
  gender?: string;
  ageRange?: string;
  tone?: string;
  speakingStyle?: string;
  pace?: string;
  pitch?: string;
  description?: string;
}

export interface CreateLorebookEntryDto {
  title: string;
  content: string;
  keywords: string[];
  category: number;
  isConstant?: boolean;
  priority?: number;
}

export interface LorebookEntry {
  id: string;
  characterId: string;
  title: string;
  content: string;
  keywords: string[];
  category: string | number;
  isConstant: boolean;
  priority: number;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  personalityPrompt: string;
  greeting?: string;
  category?: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  createdBy?: string;
  creatorName?: string;
  creatorUserName?: string;
  creatorAvatar?: string;
  defaultAffectionScore?: number;
  defaultMood?: string;
  customMilestones?: RelationshipMilestone[];
  blueprint?: CharacterBlueprint;
  visualIdentity?: CharacterVisualIdentity;
  voiceProfile?: CharacterVoiceProfile;
  worldName?: string;
  worldDescription?: string;
  worldGenre?: WorldGenre | number;
  customPhysicsRules?: string;
}

export interface CreateCharacterRequest {
  name: string;
  title: string;
  avatarUrl: string;
  personalityPrompt: string;
  greeting?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  defaultAffectionScore?: number;
  defaultMood?: string;
  customMilestones?: RelationshipMilestone[];
  blueprint?: CharacterBlueprint;
  visualIdentity?: CharacterVisualIdentity;
  voiceProfile?: CharacterVoiceProfile;
  worldName?: string;
  worldDescription?: string;
  worldGenre?: WorldGenre | number;
  customPhysicsRules?: string;
  initialLorebookEntries?: CreateLorebookEntryDto[];
}

export interface UpdateCharacterRequest {
  name: string;
  title: string;
  avatarUrl: string;
  personalityPrompt: string;
  greeting?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  defaultAffectionScore?: number;
  defaultMood?: string;
  customMilestones?: RelationshipMilestone[];
  blueprint?: CharacterBlueprint;
  visualIdentity?: CharacterVisualIdentity;
  voiceProfile?: CharacterVoiceProfile;
  worldName?: string;
  worldDescription?: string;
  worldGenre?: WorldGenre | number;
  customPhysicsRules?: string;
}

export interface GeneratedCharacterDto {
  name: string;
  title: string;
  category: string;
  personalityPrompt: string;
  greeting: string;
  tags: string[];
  defaultAffectionScore?: number;
  defaultMood?: string;
  worldGenre?: WorldGenre | number;
  worldName?: string;
  worldDescription?: string;
  customPhysicsRules?: string;
  customMilestones?: RelationshipMilestone[];
  blueprint?: CharacterBlueprint;
  visualIdentity?: CharacterVisualIdentity;
  voiceProfile?: CharacterVoiceProfile;
  initialLorebookEntries?: CreateLorebookEntryDto[];
}

export enum MessageRole {
  User = 1,
  Assistant = 2,
  System = 3,
}

export enum SessionStatus {
  Active = 1,
  WalkedOut = 2,
  Closed = 3,
}

export type SceneImageUIStatus = "idle" | "queued" | "pending" | "processing" | "completed" | "failed" | "timeout" | "cancelled";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  turnId?: string | null;
  sceneImageUrl?: string | null;
  sceneImageStatus?: "queued" | "pending" | "processing" | "completed" | "failed" | "timeout" | "cancelled" | null;
  generationRequestId?: string | null;
  isStreaming?: boolean | null;
}

export interface TriggerSceneImageResponse {
  generationRequestId: string;
  turnId: string;
  status: string;
}

export interface SceneImageStatusResponse {
  generationRequestId: string;
  turnId: string;
  sessionId: string;
  status: "queued" | "pending" | "processing" | "completed" | "failed" | "cancelled" | string;
  imageUrl?: string | null;
  failureReason?: string | null;
  isRetryable?: boolean | null;
  sceneRevision?: number | null;
  prompt?: string | null;
  createdAt?: string | null;
}

export interface SceneImageDto {
  id: string;
  sessionId: string;
  characterId: string;
  turnId: string;
  sceneRevision: number;
  generationRequestId: string;
  imageUrl: string;
  prompt: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface RelationshipEvent {
  eventKey: string;
  context: string;
  unlockedAt: string;
}

export interface ChatSession {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  characterTitle?: string;
  characterPersonality?: string;
  characterCategory?: string;
  affectionScore: number;
  relationshipLevel: number;
  relationshipStage?: string;
  currentMood?: string;
  moodIntensity?: number;
  unlockedEvents?: RelationshipEvent[];
  status?: SessionStatus | string | number;
  walkOutReason?: string | null;
  walkedOutAt?: string | null;
}

export interface ChatSessionListItem {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar: string;
  title: string;
  lastMessageContent: string | null;
  lastMessageTime: string | null;
  messageCount: number;
  createdAt: string;
  affectionScore?: number;
  relationshipLevel?: number;
  relationshipStage?: string;
  status?: SessionStatus | string | number;
  walkOutReason?: string | null;
}

export interface SendMessageResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  affectionScore: number;
  relationshipLevel: number;
  relationshipStage?: string;
  currentMood: string;
  moodIntensity?: number;
  affectionDelta: number;
  levelUp: boolean;
  unlockedEvent?: RelationshipEvent | null;
  hasWalkedOut?: boolean;
  walkOutReason?: string | null;
  sessionStatus?: SessionStatus | string | number;
  turnId?: string | null;
}

export interface ProactiveReachoutRequest {
  characterId: string;
  userId: string;
}

export interface ProactiveReachoutResponse {
  sessionId: string;
  characterId: string;
  characterName: string;
  characterAvatar: string;
  openingMessage: string;
  matchReason: string;
  createdAt: string;
}

export enum MemoryType {
  UserFact = 1,
  UserPreference = 2,
  RelationshipEvent = 3,
  Secret = 4,
  WorldFact = 5,
}

export interface CharacterMemory {
  id: string;
  content: string;
  type: MemoryType | string | number;
  importance: number;
  confidence: number;
  createdAt: string;
  lastAccessedAt?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors: string[];
}
