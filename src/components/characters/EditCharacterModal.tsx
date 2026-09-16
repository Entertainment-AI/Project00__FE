"use client";

import { useState, useRef, useEffect } from "react";
import {
  Character,
  UpdateCharacterRequest,
  RelationshipMilestone,
  WorldGenre,
  CharacterBlueprint,
  CharacterVisualIdentity,
  CharacterVoiceProfile,
} from "@/types";
import { generateCharacterAvatar } from "@/lib/api";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";
import { WORLD_GENRE_OPTIONS } from "./CreateCharacterModal";
import RelationshipMilestonesEditor from "./RelationshipMilestonesEditor";
import {
  X,
  Edit2,
  Sparkles,
  Heart,
  Flame,
  Wand2,
  Swords,
  Bot,
  GraduationCap,
  ChevronDown,
  Check,
  Loader2,
  Upload,
  Globe,
  Brain,
  Volume2,
  Eye,
  UserCheck,
} from "lucide-react";

interface EditCharacterModalProps {
  character: Character | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (characterId: string, req: UpdateCharacterRequest) => Promise<void>;
}

const CATEGORIES = [
  { id: "Companion", label: "Bạn đồng hành", icon: Heart },
  { id: "Anime", label: "Anime", icon: Flame },
  { id: "Fantasy", label: "Kỳ ảo", icon: Wand2 },
  { id: "RPG", label: "Nhập vai", icon: Swords },
  { id: "Assistant", label: "Trợ lý", icon: Bot },
  { id: "Mentor", label: "Cố vấn", icon: GraduationCap },
];

type ActiveTab = "profile" | "world" | "psychology" | "intimacy";

export function EditCharacterModal({
  character,
  isOpen,
  onClose,
  onSubmit,
}: EditCharacterModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");

  // Tab 1: Profile & Visual
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Companion");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [rawAvatarImage, setRawAvatarImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [personalityPrompt, setPersonalityPrompt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Visual Identity
  const [hair, setHair] = useState("");
  const [eyes, setEyes] = useState("");
  const [clothingStyle, setClothingStyle] = useState("");
  const [visualTraits, setVisualTraits] = useState("");

  // Tab 2: World & Universe
  const [worldGenre, setWorldGenre] = useState<WorldGenre>(WorldGenre.MundaneSliceOfLife);
  const [worldName, setWorldName] = useState("");
  const [worldDescription, setWorldDescription] = useState("");
  const [customPhysicsRules, setCustomPhysicsRules] = useState("");

  // Tab 3: Psychology Blueprint
  const [desires, setDesires] = useState("");
  const [fears, setFears] = useState("");
  const [whenAngry, setWhenAngry] = useState("");
  const [whenHappy, setWhenHappy] = useState("");
  const [antiSycophancy, setAntiSycophancy] = useState("");
  const [boundaries, setBoundaries] = useState("");

  // Tab 4: Intimacy & Voice
  const [defaultAffectionScore, setDefaultAffectionScore] = useState<number>(0);
  const [defaultMood, setDefaultMood] = useState<string>("Bình thường");
  const [customMilestones, setCustomMilestones] = useState<RelationshipMilestone[]>([]);
  const [voiceGender, setVoiceGender] = useState("Female");
  const [voiceTone, setVoiceTone] = useState("Dịu dàng, ấm áp");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form state when character changes or modal opens
  useEffect(() => {
    if (character && isOpen) {
      setName(character.name || "");
      setTitle(character.title || "");
      setCategory(character.category || "Companion");
      setAvatarUrl(character.avatarUrl || "");
      setRawAvatarImage(character.avatarUrl || null);
      setPersonalityPrompt(character.personalityPrompt || "");
      setTagsInput(character.tags?.join(", ") || "");
      setIsPublic(character.isPublic ?? true);
      setDefaultAffectionScore(character.defaultAffectionScore ?? 0);
      setDefaultMood(character.defaultMood || "Bình thường");
      setCustomMilestones(character.customMilestones || []);

      if (character.worldGenre !== undefined) {
        setWorldGenre(Number(character.worldGenre) as WorldGenre);
      }
      setWorldName(character.worldName || "");
      setWorldDescription(character.worldDescription || "");
      setCustomPhysicsRules(character.customPhysicsRules || "");

      if (character.blueprint) {
        setDesires(character.blueprint.psychology?.desires || "");
        setFears(character.blueprint.psychology?.fears || "");
        setWhenAngry(character.blueprint.behavior?.whenAngry || "");
        setWhenHappy(character.blueprint.behavior?.whenHappy || "");
        setAntiSycophancy(character.blueprint.rules?.antiSycophancy || "");
        setBoundaries(character.blueprint.rules?.boundaries?.join("; ") || "");
      }

      if (character.visualIdentity) {
        setHair(character.visualIdentity.hair || "");
        setEyes(character.visualIdentity.eyes || "");
        setClothingStyle(character.visualIdentity.clothingStyle || "");
        setVisualTraits(character.visualIdentity.visualTraits || "");
      }

      if (character.voiceProfile) {
        setVoiceGender(character.voiceProfile.gender || "Female");
        setVoiceTone(character.voiceProfile.tone || "Dịu dàng, ấm áp");
      }
    }
  }, [character, isOpen]);

  const handleGenerateAvatarAi = async () => {
    if (isGeneratingAvatar) return;
    try {
      setIsGeneratingAvatar(true);
      setError(null);
      const res = await generateCharacterAvatar({
        name: name.trim() || character?.name,
        title: title.trim() || character?.title,
        category: category || character?.category,
        personalityPrompt: personalityPrompt.trim() || character?.personalityPrompt,
        visualIdentity: character?.visualIdentity,
      });

      if (res?.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        setRawAvatarImage(res.avatarUrl);
      }
    } catch {
      setError("Không thể vẽ ảnh đại diện tự động. Vui lòng thử lại!");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character) return;
    if (!name.trim()) {
      setError("Vui lòng nhập tên nhân vật!");
      return;
    }
    if (!personalityPrompt.trim()) {
      setError("Vui lòng nhập tiểu sử và tính cách nhân vật!");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const blueprint: CharacterBlueprint = {
        psychology: {
          desires: desires.trim() || undefined,
          fears: fears.trim() || undefined,
        },
        behavior: {
          whenAngry: whenAngry.trim() || undefined,
          whenHappy: whenHappy.trim() || undefined,
        },
        rules: {
          antiSycophancy: antiSycophancy.trim() || undefined,
          boundaries: boundaries.trim() ? boundaries.split(";").map((b) => b.trim()).filter(Boolean) : undefined,
        },
      };

      const visualIdentity: CharacterVisualIdentity = {
        style: character.visualIdentity?.style || "Realistic",
        visualStyle: character.visualIdentity?.visualStyle || "Realistic",
        hair: hair.trim() || undefined,
        eyes: eyes.trim() || undefined,
        clothingStyle: clothingStyle.trim() || undefined,
        visualTraits: visualTraits.trim() || undefined,
      };

      const voiceProfile: CharacterVoiceProfile = {
        voiceId: "vi-VN-HoaiMyNeural",
        gender: voiceGender,
        tone: voiceTone,
      };

      const req: UpdateCharacterRequest = {
        name: name.trim(),
        title: title.trim(),
        category,
        avatarUrl: avatarUrl.trim() || character.avatarUrl,
        personalityPrompt: personalityPrompt.trim(),
        greeting: "", // No forced greeting
        tags: parsedTags,
        isPublic,
        defaultAffectionScore,
        defaultMood: defaultMood.trim() || "Bình thường",
        worldGenre,
        worldName: worldName.trim() || undefined,
        worldDescription: worldDescription.trim() || undefined,
        customPhysicsRules: customPhysicsRules.trim() || undefined,
        blueprint,
        visualIdentity,
        voiceProfile,
        customMilestones: customMilestones.length > 0 ? customMilestones : undefined,
      };

      await onSubmit(character.id, req);
      onClose();
    } catch (err: any) {
      console.error("Failed to update character:", err);
      setError(err.message || "Cập nhật nhân vật thất bại. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !character) return null;

  const currentCategory = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  const CategoryIcon = currentCategory.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#1c1d22] border border-[#2e3038] rounded-3xl shadow-2xl overflow-hidden text-zinc-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2c34] bg-[#17181c] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#26272e] border border-[#373943] flex items-center justify-center">
              <Edit2 className="h-4 w-4 text-zinc-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                Chỉnh Sửa Nhân Vật: {character.name}
              </h2>
              <p className="text-xs text-zinc-400">
                Tinh chỉnh 7 đặc tính, thế giới và tâm lý học
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-[#282a32] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-2 border-b border-[#282a32] bg-[#141518] overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "border-zinc-100 text-zinc-100 bg-white/5 rounded-t-xl"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UserCheck className="h-4 w-4" />
            1. Hồ Sơ & Ngoại Hình
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("world")}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "world"
                ? "border-zinc-100 text-zinc-100 bg-white/5 rounded-t-xl"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Globe className="h-4 w-4" />
            2. Vũ Trụ & Thế Giới
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("psychology")}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "psychology"
                ? "border-zinc-100 text-zinc-100 bg-white/5 rounded-t-xl"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Brain className="h-4 w-4" />
            3. Tâm Lý & Ranh Giới
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("intimacy")}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "intimacy"
                ? "border-zinc-100 text-zinc-100 bg-white/5 rounded-t-xl"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Heart className="h-4 w-4" />
            4. Tình Cảm & Giọng Nói
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 text-xs sm:text-sm text-red-300 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB 1: PROFILE & VISUAL */}
          {activeTab === "profile" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Avatar Column */}
                <div className="md:col-span-4 flex flex-col items-center p-4 rounded-2xl bg-[#17181c] border border-[#2b2d35]">
                  <label className="text-xs font-bold text-zinc-300 mb-3">Ảnh Đại Diện</label>
                  <div className="relative group w-32 h-32 rounded-2xl overflow-hidden bg-[#212227] border border-[#383a44] flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-zinc-500">Chưa có ảnh</span>
                    )}

                    {isGeneratingAvatar && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-1.5 text-[11px] text-zinc-200">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-200" />
                        <span>AI Đang Vẽ...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 w-full mt-3">
                    <button
                      type="button"
                      onClick={() => handleGenerateAvatarAi()}
                      disabled={isGeneratingAvatar}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#26272e] border border-[#383a45] text-zinc-200 hover:bg-[#30323c] text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                    >
                      <Wand2 className="h-3.5 w-3.5 text-zinc-300" />
                      AI Vẽ Ảnh
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center p-2 rounded-xl bg-[#26272e] hover:bg-[#30323c] border border-[#383a45] text-zinc-300 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setRawAvatarImage(reader.result as string);
                            setIsCropperOpen(true);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Info Fields */}
                <div className="md:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Tên Nhân Vật <span className="text-zinc-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Danh Hiệu / Vai Trò <span className="text-zinc-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Category Dropdown */}
                    <div className="relative" ref={categoryDropdownRef}>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">Thể Loại Phân Mục</label>
                      <button
                        type="button"
                        onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                        className="w-full flex items-center justify-between rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400"
                      >
                        <span className="flex items-center gap-2">
                          <CategoryIcon className="h-4 w-4 text-zinc-300" />
                          {currentCategory.label}
                        </span>
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      </button>

                      {isCategoryOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1c1d22] border border-[#343742] rounded-xl shadow-xl z-30 py-1.5">
                          {CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setCategory(cat.id);
                                  setIsCategoryOpen(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-200 hover:bg-[#26272e] hover:text-white transition-colors"
                              >
                                <Icon className="h-4 w-4 text-zinc-300" />
                                {cat.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">Thẻ Từ Khóa (Tags)</label>
                      <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Personality Prompt & Bio */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Tiểu Sử & Cuộc Đời Nhân Vật <span className="text-zinc-400">*</span>
                </label>
                <textarea
                  rows={6}
                  value={personalityPrompt}
                  onChange={(e) => setPersonalityPrompt(e.target.value)}
                  className="w-full rounded-2xl border border-[#31333c] bg-[#141518] p-3.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Visual Traits Breakdown */}
              <div className="p-4 rounded-2xl bg-[#17181c] border border-[#2b2d35] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <Eye className="h-4 w-4 text-zinc-400" />
                  Đặc Điểm Nhận Diện Thị Giác
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Mái Tóc</label>
                    <input
                      type="text"
                      value={hair}
                      onChange={(e) => setHair(e.target.value)}
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Đôi Mắt</label>
                    <input
                      type="text"
                      value={eyes}
                      onChange={(e) => setEyes(e.target.value)}
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Gu Trang Phục</label>
                    <input
                      type="text"
                      value={clothingStyle}
                      onChange={(e) => setClothingStyle(e.target.value)}
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Nét Đặc Trưng</label>
                    <input
                      type="text"
                      value={visualTraits}
                      onChange={(e) => setVisualTraits(e.target.value)}
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WORLD & UNIVERSE */}
          {activeTab === "world" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  Chọn Thể Loại Vũ Trụ & Thế Giới (World Genre)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {WORLD_GENRE_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setWorldGenre(g.id)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        worldGenre === g.id
                          ? "bg-[#272832] border-zinc-200 shadow-md"
                          : "bg-[#141518] border-[#2b2d35] hover:border-[#3e414c] hover:bg-[#1c1d22]"
                      }`}
                    >
                      <div className="text-xl mb-1">{g.emoji}</div>
                      <div>
                        <div className="text-xs font-bold text-zinc-100">{g.label}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{g.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Tên Thế Giới / Thành Phố</label>
                  <input
                    type="text"
                    value={worldName}
                    onChange={(e) => setWorldName(e.target.value)}
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Quy Tắc Vật Lý / Sức Mạnh Tùy Biến</label>
                  <input
                    type="text"
                    value={customPhysicsRules}
                    onChange={(e) => setCustomPhysicsRules(e.target.value)}
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Mô Tả Bối Cảnh & Môi Trường Thế Giới</label>
                <textarea
                  rows={3}
                  value={worldDescription}
                  onChange={(e) => setWorldDescription(e.target.value)}
                  className="w-full rounded-2xl border border-[#31333c] bg-[#141518] p-3 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PSYCHOLOGY & BOUNDARIES */}
          {activeTab === "psychology" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Khát Vọng Thầm Kín (Desires)</label>
                  <input
                    type="text"
                    value={desires}
                    onChange={(e) => setDesires(e.target.value)}
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Nỗi Sợ Sâu Nhất (Fears)</label>
                  <input
                    type="text"
                    value={fears}
                    onChange={(e) => setFears(e.target.value)}
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Phản Ứng Khi Tức Giận</label>
                  <input
                    type="text"
                    value={whenAngry}
                    onChange={(e) => setWhenAngry(e.target.value)}
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Phản Ứng Khi Vui Vẻ</label>
                  <input
                    type="text"
                    value={whenHappy}
                    onChange={(e) => setWhenHappy(e.target.value)}
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Ranh Giới Đỏ Cá Nhân</label>
                <input
                  type="text"
                  value={boundaries}
                  onChange={(e) => setBoundaries(e.target.value)}
                  className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: INTIMACY & VOICE */}
          {activeTab === "intimacy" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Điểm Thiện Cảm Mặc Định: <span className="text-zinc-100">{defaultAffectionScore}</span> / 100
                  </label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={defaultAffectionScore}
                    onChange={(e) => setDefaultAffectionScore(Number(e.target.value))}
                    className="w-full accent-zinc-200 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Tâm Trạng Khởi Đầu</label>
                  <input
                    type="text"
                    value={defaultMood}
                    onChange={(e) => setDefaultMood(e.target.value)}
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Voice Profile */}
              <div className="p-4 rounded-2xl bg-[#17181c] border border-[#2b2d35] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <Volume2 className="h-4 w-4 text-zinc-400" />
                  Hồ Sơ Giọng Nói AI
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Giới Tính Giọng Đọc</label>
                    <select
                      value={voiceGender}
                      onChange={(e) => setVoiceGender(e.target.value)}
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    >
                      <option value="Female">Nữ (Female - Hoài My)</option>
                      <option value="Male">Nam (Male - Nam Minh)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Ngữ Điệu Giọng Nói</label>
                    <input
                      type="text"
                      value={voiceTone}
                      onChange={(e) => setVoiceTone(e.target.value)}
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Milestones Editor */}
              <div>
                <RelationshipMilestonesEditor
                  milestones={customMilestones}
                  onChange={setCustomMilestones}
                />
              </div>
            </div>
          )}

          {/* Footer Submit Bar */}
          <div className="pt-4 border-t border-[#292b33] flex items-center justify-between sticky bottom-0 bg-[#1c1d22] shrink-0">
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded accent-zinc-200 h-4 w-4"
              />
              Công khai cho cộng đồng
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#32353e] hover:bg-[#282a32] text-xs font-semibold text-zinc-300 transition-colors"
              >
                Hủy
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                    <span>Đang Lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Lưu Thay Đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Cropper Modal */}
        {isCropperOpen && rawAvatarImage && (
          <ImageCropperModal
            isOpen={isCropperOpen}
            imageSrc={rawAvatarImage}
            onSave={(croppedUrl: string) => {
              setAvatarUrl(croppedUrl);
              setIsCropperOpen(false);
            }}
            onClose={() => setIsCropperOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
