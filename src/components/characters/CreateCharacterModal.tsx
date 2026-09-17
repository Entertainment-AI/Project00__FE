"use client";

import { useState, useRef, useEffect } from "react";
import {
  CreateCharacterRequest,
  RelationshipMilestone,
  WorldGenre,
  CharacterBlueprint,
  CharacterVisualIdentity,
  CharacterVoiceProfile,
  CreateLorebookEntryDto,
} from "@/types";
import { generateCharacterWithAi, fetchAiRandomIdeas, generateCharacterAvatar, generateCharacterStandee } from "@/lib/api";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";
import RelationshipMilestonesEditor from "./RelationshipMilestonesEditor";
import { VISUAL_STYLE_OPTIONS, normalizeVisualStyle } from "@/lib/constants";
import {
  X,
  Sparkles,
  Wand2,
  Heart,
  Flame,
  Swords,
  Bot,
  GraduationCap,
  ChevronDown,
  Check,
  Loader2,
  Upload,
  RotateCcw,
  Lightbulb,
  Globe,
  Image as ImageIcon,
  Brain,
  BrainCircuit,
  BookOpen,
  Volume2,
  Eye,
  Plus,
  Trash2,
  UserCheck,
  Crop,
} from "lucide-react";

import { WORLD_GENRE_OPTIONS } from "@/lib/constants";
export { WORLD_GENRE_OPTIONS };

interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (req: CreateCharacterRequest) => Promise<void>;
}

const GENDER_OPTIONS = [
  { id: "Female", label: "Nữ" },
  { id: "Male", label: "Nam" },
  { id: "Other", label: "Khác / Vô tính" },
];

const CATEGORIES = [
  { id: "Companion", label: "Bạn đồng hành", icon: Heart },
  { id: "Anime", label: "Anime", icon: Flame },
  { id: "Fantasy", label: "Kỳ ảo", icon: Wand2 },
  { id: "RPG", label: "Nhập vai", icon: Swords },
  { id: "Assistant", label: "Trợ lý", icon: Bot },
  { id: "Mentor", label: "Cố vấn", icon: GraduationCap },
];

const INSPIRATION_IDEAS = [
  "Nữ kiếm sĩ lang thang mang theo huyết kiếm phong ấn, đơn độc săn lùng quái thú cổ đại.",
  "Chủ tiệm trà thảo mộc kiêm thầy bói Tarot tại phố cổ, luôn thấu suốt tâm can người đối diện.",
  "Tiểu thư quý tộc mê cơ khí ma pháp, bí mật chế tạo khinh khí cầu tại xưởng ngầm.",
  "Thủ lĩnh lính đánh thuê thiện chiến, bề ngoài lạnh lùng nhưng nội tâm mang gánh nặng chuộc tội.",
  "Nhà nghiên cứu khảo cổ học dị giới, ngày đêm giải mã tàn tích của nền văn minh biến mất.",
  "Nữ hoàng đế quốc cai trị bằng bàn tay sắt, luôn ẩn giấu nỗi cô đơn trên ngai vàng quyền lực.",
  "Nghệ sĩ vĩ cầm thiên tài có tính cách lập dị, chỉ diễn tấu dưới những cơn mưa đêm lạnh giá.",
  "Nữ đặc vụ giải mã công nghệ Cyberpunk, sống ẩn dật giữa khu phố đèn neon rực rỡ."
];


function getRandomIdeas(count = 3): string[] {
  const shuffled = [...INSPIRATION_IDEAS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

type ActiveTab = "profile" | "world" | "psychology" | "lorebook" | "intimacy";

export function CreateCharacterModal({ isOpen, onClose, onSubmit }: CreateCharacterModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");

  // Tab 1: Profile & Visual
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Companion");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [rawAvatarImage, setRawAvatarImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [fullBodyUrl, setFullBodyUrl] = useState("");
  const [rawFullBodyImage, setRawFullBodyImage] = useState<string | null>(null);
  const [isFullBodyCropperOpen, setIsFullBodyCropperOpen] = useState(false);
  const fullBodyFileInputRef = useRef<HTMLInputElement>(null);
  const [personalityPrompt, setPersonalityPrompt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Visual Identity
  const [visualStyle, setVisualStyle] = useState("Anime");
  const [isAiStyleDropdownOpen, setIsAiStyleDropdownOpen] = useState(false);
  const aiStyleDropdownRef = useRef<HTMLDivElement>(null);
  const [gender, setGender] = useState("Female");
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef<HTMLDivElement>(null);
  const [hair, setHair] = useState("");
  const [eyes, setEyes] = useState("");
  const [face, setFace] = useState("");
  const [ageAppearance, setAgeAppearance] = useState("");
  const [skin, setSkin] = useState("");
  const [body, setBody] = useState("");
  const [clothingStyle, setClothingStyle] = useState("");
  const [accessories, setAccessories] = useState("");
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

  // Tab 4: Lorebook Entries
  const [lorebookEntries, setLorebookEntries] = useState<CreateLorebookEntryDto[]>([]);
  const [newLoreTitle, setNewLoreTitle] = useState("");
  const [newLoreContent, setNewLoreContent] = useState("");
  const [newLoreKeywords, setNewLoreKeywords] = useState("");

  // Tab 5: Intimacy & Voice
  const [defaultAffectionScore, setDefaultAffectionScore] = useState<number>(0);
  const [defaultMood, setDefaultMood] = useState<string>("Bình thường");
  const [customMilestones, setCustomMilestones] = useState<RelationshipMilestone[]>([]);
  const [voiceGender, setVoiceGender] = useState("Female");
  const [voiceTone, setVoiceTone] = useState("Dịu dàng, ấm áp");

  // AI Assistant States
  const [aiIdea, setAiIdea] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isGeneratingStandee, setIsGeneratingStandee] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>(() => getRandomIdeas(3));
  const [isRefreshingIdeas, setIsRefreshingIdeas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target as Node)) {
        setIsGenderDropdownOpen(false);
      }
      if (aiStyleDropdownRef.current && !aiStyleDropdownRef.current.contains(event.target as Node)) {
        setIsAiStyleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRefreshSuggestions = async () => {
    if (isRefreshingIdeas) return;
    try {
      setIsRefreshingIdeas(true);
      const aiIdeas = await fetchAiRandomIdeas(3);
      if (aiIdeas && aiIdeas.length > 0) {
        setSuggestedIdeas(aiIdeas);
      } else {
        setSuggestedIdeas(getRandomIdeas(3));
      }
    } catch {
      setSuggestedIdeas(getRandomIdeas(3));
    } finally {
      setIsRefreshingIdeas(false);
    }
  };

  const canGenerateAvatar = Boolean(name.trim() && title.trim() && personalityPrompt.trim());

  const handleGenerateAvatarAi = async (
    customPrompt?: string,
    customName?: string,
    customTitle?: string,
    customVisualIdentity?: CharacterVisualIdentity,
    customWorldGenre?: WorldGenre | number
  ) => {
    if (isGeneratingAvatar) return;
    const targetName = (customName || name).trim();
    const targetTitle = (customTitle || title).trim();
    const targetBio = (customPrompt || personalityPrompt).trim();
    const targetVisualIdentity: CharacterVisualIdentity = customVisualIdentity || {
      gender,
      style: visualStyle,
      visualStyle: visualStyle,
      hair,
      eyes,
      face,
      ageAppearance,
      skin,
      body,
      clothingStyle,
      accessories,
      visualTraits,
    };
    const targetWorldGenre = customWorldGenre !== undefined ? customWorldGenre : worldGenre;

    if (!targetName || !targetTitle || !targetBio) {
      setError("Vui lòng điền đầy đủ Tên Nhân Vật, Danh Hiệu và Tiểu Sử để AI có đủ dữ kiện vẽ ảnh chân dung chính xác!");
      return;
    }

    let newlyGeneratedAvatarUrl: string | null = null;
    try {
      setIsGeneratingAvatar(true);
      setError(null);
      const res = await generateCharacterAvatar({
        name: targetName,
        title: targetTitle,
        category: category || "Companion",
        personalityPrompt: targetBio,
        idea: aiIdea.trim() || "",
        worldGenre: targetWorldGenre,
        visualIdentity: targetVisualIdentity,
      });
      if (res && res.avatarUrl) {
        newlyGeneratedAvatarUrl = res.avatarUrl;
        setAvatarUrl(res.avatarUrl);
        setRawAvatarImage(res.avatarUrl);
      }
    } catch (err: any) {
      console.warn("AI avatar generation failed:", err);
      setError(err.message || "Không thể vẽ ảnh bằng AI lúc này.");
      return;
    } finally {
      setIsGeneratingAvatar(false);
    }

    if (newlyGeneratedAvatarUrl) {
      try {
        setIsGeneratingStandee(true);
        const standeeRes = await generateCharacterStandee({
          name: targetName,
          title: targetTitle,
          personalityPrompt: targetBio,
          worldGenre: targetWorldGenre,
          visualIdentity: targetVisualIdentity,
          avatarUrl: newlyGeneratedAvatarUrl,
          referenceImageUrl: newlyGeneratedAvatarUrl,
        });
        if (standeeRes?.standeeUrl) {
          setFullBodyUrl(standeeRes.standeeUrl);
          setRawFullBodyImage(standeeRes.standeeUrl);
        }
      } catch (standeeErr: any) {
        console.warn("Auto-generate standee failed:", standeeErr);
      } finally {
        setIsGeneratingStandee(false);
      }
    }
  };

  const handleGenerateWithAi = async (customIdea?: string) => {
    const text = (customIdea || aiIdea).trim();
    if (!text) {
      setError("Vui lòng nhập ý tưởng nhân vật để AI tự sinh thông tin!");
      return;
    }
    try {
      setIsGeneratingAi(true);
      setError(null);
      const generated = await generateCharacterWithAi(text, category, visualStyle);

      if (generated) {
        setName(generated.name || "");
        setTitle(generated.title || "");
        if (generated.category) setCategory(generated.category);
        setPersonalityPrompt(generated.personalityPrompt || "");
        if (generated.tags && generated.tags.length > 0) {
          setTagsInput(generated.tags.join(", "));
        }
        if (generated.defaultAffectionScore !== undefined) {
          setDefaultAffectionScore(generated.defaultAffectionScore);
        }
        if (generated.worldGenre !== undefined && generated.worldGenre !== null) {
          if (typeof generated.worldGenre === "number") {
            setWorldGenre(generated.worldGenre as WorldGenre);
          } else if (typeof generated.worldGenre === "string") {
            const parsedNum = Number(generated.worldGenre);
            if (!isNaN(parsedNum)) {
              setWorldGenre(parsedNum as WorldGenre);
            } else {
              const gStr = (generated.worldGenre as string).toLowerCase();
              if (gStr.includes("fantasy") || gStr.includes("tiên") || gStr.includes("kiếm")) setWorldGenre(WorldGenre.HighFantasy);
              else if (gStr.includes("urban") || gStr.includes("supernatural") || gStr.includes("dị năng") || gStr.includes("siêu")) setWorldGenre(WorldGenre.UrbanSupernatural);
              else if (gStr.includes("cyber") || gStr.includes("sci") || gStr.includes("viễn tưởng") || gStr.includes("tương lai")) setWorldGenre(WorldGenre.CyberpunkSciFi);
              else if (gStr.includes("history") || gStr.includes("historical") || gStr.includes("cổ trang") || gStr.includes("lịch sử")) setWorldGenre(WorldGenre.Historical);
              else if (gStr.includes("custom") || gStr.includes("tự do")) setWorldGenre(WorldGenre.Custom);
              else setWorldGenre(WorldGenre.MundaneSliceOfLife);
            }
          }
        }
        if (generated.worldName) setWorldName(generated.worldName);
        if (generated.worldDescription) setWorldDescription(generated.worldDescription);
        if (generated.customPhysicsRules) setCustomPhysicsRules(generated.customPhysicsRules);

        // Blueprint
        if (generated.blueprint) {
          if (generated.blueprint.psychology?.desires) setDesires(generated.blueprint.psychology.desires);
          if (generated.blueprint.psychology?.fears) setFears(generated.blueprint.psychology.fears);
          if (generated.blueprint.behavior?.whenAngry) setWhenAngry(generated.blueprint.behavior.whenAngry);
          if (generated.blueprint.behavior?.whenHappy) setWhenHappy(generated.blueprint.behavior.whenHappy);
          if (generated.blueprint.rules?.antiSycophancy) setAntiSycophancy(generated.blueprint.rules.antiSycophancy);
          if (generated.blueprint.rules?.boundaries) setBoundaries(generated.blueprint.rules.boundaries.join("; "));
        }

        // Visual Identity
        if (generated.visualIdentity) {
          if (generated.visualIdentity.gender) {
            setGender(generated.visualIdentity.gender);
            if (generated.visualIdentity.gender === "Male") setVoiceGender("Male");
            else if (generated.visualIdentity.gender === "Female") setVoiceGender("Female");
          }
          if (generated.visualIdentity.hair) setHair(generated.visualIdentity.hair);
          if (generated.visualIdentity.eyes) setEyes(generated.visualIdentity.eyes);
          if (generated.visualIdentity.face) setFace(generated.visualIdentity.face);
          if (generated.visualIdentity.ageAppearance) setAgeAppearance(generated.visualIdentity.ageAppearance);
          if (generated.visualIdentity.skin) setSkin(generated.visualIdentity.skin);
          if (generated.visualIdentity.body) setBody(generated.visualIdentity.body);
          if (generated.visualIdentity.clothingStyle) setClothingStyle(generated.visualIdentity.clothingStyle);
          if (generated.visualIdentity.accessories) setAccessories(generated.visualIdentity.accessories);
          if (generated.visualIdentity.visualTraits) setVisualTraits(generated.visualIdentity.visualTraits);
          if (generated.visualIdentity.fullBodyUrl) {
            setFullBodyUrl(generated.visualIdentity.fullBodyUrl);
          } else if (generated.visualIdentity.canonicalReferenceUrl) {
            setFullBodyUrl(generated.visualIdentity.canonicalReferenceUrl);
          }
        }

        // Voice Profile
        if (generated.voiceProfile) {
          if (generated.voiceProfile.gender) {
            setVoiceGender(generated.voiceProfile.gender === "Male" ? "Male" : "Female");
          }
          if (generated.voiceProfile.tone) {
            setVoiceTone(generated.voiceProfile.tone);
          }
        }

        // Lorebook Entries
        if (generated.initialLorebookEntries && generated.initialLorebookEntries.length > 0) {
          setLorebookEntries(generated.initialLorebookEntries);
        }

        // Custom Milestones
        if (generated.customMilestones && generated.customMilestones.length > 0) {
          setCustomMilestones(generated.customMilestones);
        }

        // Auto trigger AI avatar generation
        handleGenerateAvatarAi(
          generated.personalityPrompt,
          generated.name,
          generated.title,
          {
            ...(generated.visualIdentity || {}),
            style: visualStyle,
            visualStyle: visualStyle,
          },
          generated.worldGenre !== undefined ? Number(generated.worldGenre) : undefined
        );
      }
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      setError(err.message || "Tạo bằng AI thất bại. Vui lòng thử lại!");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAddLorebook = () => {
    if (!newLoreTitle.trim() || !newLoreContent.trim()) return;
    const keywords = newLoreKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    setLorebookEntries((prev) => [
      ...prev,
      {
        title: newLoreTitle.trim(),
        content: newLoreContent.trim(),
        keywords: keywords.length > 0 ? keywords : [newLoreTitle.trim()],
        category: 1,
        isConstant: false,
        priority: 100,
      },
    ]);
    setNewLoreTitle("");
    setNewLoreContent("");
    setNewLoreKeywords("");
  };

  const handleRemoveLorebook = (index: number) => {
    setLorebookEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập tên nhân vật!");
      setActiveTab("profile");
      return;
    }
    if (!personalityPrompt.trim()) {
      setError("Vui lòng nhập tiểu sử và tính cách nhân vật!");
      setActiveTab("profile");
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
        gender: gender || undefined,
        style: visualStyle,
        visualStyle: visualStyle,
        hair: hair.trim() || undefined,
        eyes: eyes.trim() || undefined,
        face: face.trim() || undefined,
        ageAppearance: ageAppearance.trim() || undefined,
        skin: skin.trim() || undefined,
        body: body.trim() || undefined,
        clothingStyle: clothingStyle.trim() || undefined,
        accessories: accessories.trim() || undefined,
        visualTraits: visualTraits.trim() || undefined,
        fullBodyUrl: fullBodyUrl.trim() || undefined,
        canonicalReferenceUrl: fullBodyUrl.trim() || undefined,
      };

      const voiceProfile: CharacterVoiceProfile = {
        voiceId: "vi-VN-HoaiMyNeural",
        gender: voiceGender,
        tone: voiceTone,
      };

      const req: CreateCharacterRequest = {
        name: name.trim(),
        title: title.trim(),
        category,
        avatarUrl: avatarUrl.trim() || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
        personalityPrompt: personalityPrompt.trim(),
        greeting: "", // No forced greeting in 2-way social stranger network
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
        initialLorebookEntries: lorebookEntries.length > 0 ? lorebookEntries : undefined,
        customMilestones: customMilestones.length > 0 ? customMilestones : undefined,
      };

      await onSubmit(req);
      onClose();
    } catch (err: any) {
      console.error("Failed to create character:", err);
      setError(err.message || "Tạo nhân vật không thành công. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentCategory = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  const CategoryIcon = currentCategory.icon;
  const selectedGender = GENDER_OPTIONS.find((g) => g.id === gender) || GENDER_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#1c1d22] border border-[#2e3038] rounded-3xl shadow-2xl overflow-hidden text-zinc-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2c34] bg-[#17181c] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#26272e] border border-[#373943] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-zinc-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                Tạo Nhân Vật Mới
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#282a33] text-zinc-300 border border-[#3b3d48]">
                  7 Đặc Tính Sống Động
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Đầy đủ hồ sơ tâm lý, 8 mốc quan hệ động, bối cảnh thế giới & visual
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-[#25262e] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* AI Quick Architect Bar */}
        <div className="p-4 sm:p-5 bg-[#17181c]/90 border-b border-[#282a32] shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Sparkles className="h-3.5 w-3.5 text-zinc-300" />
              <span>Kiến Trúc Sư AI (Khởi tạo nhanh)</span>
            </div>
          </div>

          {/* Omnibar Input Card */}
          <div className="rounded-2xl border border-[#31333c] bg-[#121316] p-3 shadow-inner">
            <textarea
              value={aiIdea}
              onChange={(e) => setAiIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isGeneratingAi && aiIdea.trim()) {
                    handleGenerateWithAi();
                  }
                }
              }}
              rows={2}
              placeholder="Nhập ý tưởng phác thảo nhân vật (VD: Nữ sát thủ lạnh lùng nhưng rất thích bánh ngọt và mèo...)"
              className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
            />

            {/* Omnibar Bottom Toolbar */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#22232a]">
              {/* Visual Style Dropdown Selector */}
              <div className="relative" ref={aiStyleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsAiStyleDropdownOpen(!isAiStyleDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c1d22] hover:bg-[#25272e] border border-[#31333c] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  <span className="text-sm">{visualStyle === "Anime" ? "🎨" : "📷"}</span>
                  <span>{visualStyle === "Anime" ? "Hoạt Họa (Anime 2D)" : "Chân Thực (Người Thật)"}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isAiStyleDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isAiStyleDropdownOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-72 sm:w-80 rounded-2xl border border-[#383a45] bg-[#1c1d22] p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
                    <div className="text-[10px] font-bold text-zinc-400 px-2.5 py-1 uppercase tracking-wider">
                      Phong Cách AI Vẽ
                    </div>
                    <div className="space-y-1">
                      {VISUAL_STYLE_OPTIONS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setVisualStyle(s.id);
                            setIsAiStyleDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                            visualStyle === s.id
                              ? "bg-zinc-800 text-white font-bold"
                              : "text-zinc-300 hover:bg-[#282932] hover:text-white"
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 pr-2">
                            <span className="text-base shrink-0 mt-0.5">{s.id === "Anime" ? "🎨" : "📷"}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-zinc-100">{s.label}</div>
                              <div className="text-[11px] text-zinc-400 leading-snug mt-0.5 font-normal">{s.desc}</div>
                            </div>
                          </div>
                          {visualStyle === s.id && <Check className="h-4 w-4 text-zinc-200 shrink-0 ml-1" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleGenerateWithAi()}
                disabled={isGeneratingAi || !aiIdea.trim()}
                className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs sm:text-sm shadow-md active:scale-95 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-950" />
                    <span>AI Đang Thiết Kế...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>AI Tự Động Sinh 7 Đặc Tính</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick inspiration pills */}
          <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1 text-[11px] text-zinc-400 scrollbar-none">
            <span className="flex items-center gap-1 text-zinc-300 font-semibold shrink-0">
              <Lightbulb className="h-3 w-3 text-zinc-400" /> Gợi ý:
            </span>
            {suggestedIdeas.map((idea, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setAiIdea(idea);
                  handleGenerateWithAi(idea);
                }}
                className="shrink-0 max-w-[280px] truncate px-2.5 py-1 rounded-lg bg-[#212227] hover:bg-[#2c2d35] border border-[#31333a] text-zinc-300 hover:text-white transition-colors"
              >
                {idea}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRefreshSuggestions}
              disabled={isRefreshingIdeas}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className={`h-3 w-3 ${isRefreshingIdeas ? "animate-spin" : ""}`} />
            </button>
          </div>
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
            <BrainCircuit className="h-4 w-4" />
            3. Tâm Lý & Cảm Xúc
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("lorebook")}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "lorebook"
                ? "border-zinc-100 text-zinc-100 bg-white/5 rounded-t-xl"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            4. Bách Khoa Thư (Lore)
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
            <Volume2 className="h-4 w-4" />
            5. Thân Mật & Giọng Nói
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
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Dual Image Upload: Avatar + Full-Body */}
                <div className="md:col-span-5 flex flex-col p-5 rounded-2xl bg-[#17181c] border border-[#2b2d35]">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    {/* Box 1: Avatar */}
                    <div className="flex flex-col items-center">
                      <label className="text-xs font-bold text-zinc-300 mb-2">Ảnh Đại Diện</label>
                      <div
                        onClick={() => {
                          if (avatarUrl && !isGeneratingAvatar) {
                            setRawAvatarImage(avatarUrl);
                            setIsCropperOpen(true);
                          } else {
                            fileInputRef.current?.click();
                          }
                        }}
                        className="relative w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-full overflow-hidden bg-[#212227] border-2 border-[#383a44] hover:border-zinc-300 flex items-center justify-center cursor-pointer transition-all group shadow-inner ring-2 ring-black/40"
                      >
                        {avatarUrl ? (
                          <>
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-semibold">
                              Cắt lại
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-2 text-zinc-500">
                            <Upload className="h-6 w-6 mx-auto mb-0.5 text-zinc-400 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px]">Tải lên</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-3">
                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setRawAvatarImage(avatarUrl);
                              setIsCropperOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#26272e] hover:bg-[#30323c] border border-[#383a45] text-zinc-300 hover:text-white transition-all cursor-pointer"
                            title="Căn chỉnh / Cắt lại ảnh đại diện"
                          >
                            <Crop className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded-lg bg-[#26272e] hover:bg-[#30323c] border border-[#383a45] text-zinc-300 hover:text-white transition-all cursor-pointer"
                          title="Tải ảnh đại diện từ máy"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Box 2: Full-Body */}
                    <div className="flex flex-col items-center">
                      <label className="text-xs font-bold text-zinc-300 mb-2">Ảnh Toàn Thân</label>
                      <div
                        onClick={() => {
                          if (fullBodyUrl && !isGeneratingAvatar && !isGeneratingStandee) {
                            setRawFullBodyImage(fullBodyUrl);
                            setIsFullBodyCropperOpen(true);
                          } else if (!isGeneratingAvatar && !isGeneratingStandee) {
                            fullBodyFileInputRef.current?.click();
                          }
                        }}
                        className="relative w-full max-w-[140px] sm:max-w-[160px] aspect-[2/3] rounded-2xl overflow-hidden bg-[#212227] border-2 border-[#383a44] hover:border-zinc-300 flex items-center justify-center cursor-pointer transition-all group shadow-inner ring-2 ring-black/40"
                      >
                        {(isGeneratingStandee || isGeneratingAvatar) && (
                          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white text-xs z-20 p-2 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-300 mb-1.5" />
                            <span className="text-[11px] text-zinc-300 font-medium leading-tight">
                              {isGeneratingAvatar ? "Chờ chân dung để đồng bộ..." : "Đang vẽ dáng đứng đồng bộ..."}
                            </span>
                          </div>
                        )}
                        {fullBodyUrl ? (
                          <>
                            <img src={fullBodyUrl} alt="Toàn thân" className="w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                              Cắt lại
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-3 text-zinc-500">
                            <ImageIcon className="h-7 w-7 mx-auto mb-1 text-zinc-400 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-medium block">Dáng Toàn Thân</span>
                            <span className="text-[9px] text-zinc-500">Tỉ lệ đứng 2:3</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-3">
                        {fullBodyUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setRawFullBodyImage(fullBodyUrl);
                              setIsFullBodyCropperOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-[#26272e] hover:bg-[#30323c] border border-[#383a45] text-zinc-300 hover:text-white transition-all cursor-pointer"
                            title="Căn chỉnh / Cắt lại ảnh toàn thân"
                          >
                            <Crop className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fullBodyFileInputRef.current?.click()}
                          className="p-1.5 rounded-lg bg-[#26272e] hover:bg-[#30323c] border border-[#383a45] text-zinc-300 hover:text-white transition-all cursor-pointer"
                          title="Tải ảnh toàn thân từ máy"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hidden inputs */}
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
                  <input
                    ref={fullBodyFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setRawFullBodyImage(reader.result as string);
                          setIsFullBodyCropperOpen(true);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />

                  {/* AI Draw Button for Both */}
                  <div className="w-full mt-4">
                    <button
                      type="button"
                      onClick={() => handleGenerateAvatarAi()}
                      disabled={isGeneratingAvatar || isGeneratingStandee || !canGenerateAvatar}
                      title={
                        !canGenerateAvatar
                          ? "Vui lòng điền Tên, Danh hiệu và Tiểu sử trước khi vẽ ảnh"
                          : "AI phân tích mô tả và vẽ cả 2 ảnh: Chân dung & Dáng đứng đồng bộ"
                      }
                      className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#26272e] border border-[#383a45] text-zinc-200 hover:bg-[#30323c] disabled:opacity-35 disabled:hover:bg-[#26272e] disabled:cursor-not-allowed text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-sm"
                    >
                      {isGeneratingAvatar || isGeneratingStandee ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />
                          {isGeneratingAvatar ? "AI Đang Vẽ Chân Dung..." : "AI Đang Vẽ Dáng Đứng..."}
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3.5 w-3.5 text-zinc-300" />
                          AI Vẽ Cả 2 Ảnh
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Info Fields */}
                <div className="md:col-span-7 space-y-4">
                  {/* Row 1: Tên Nhân Vật & Giới Tính */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Tên Nhân Vật <span className="text-zinc-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Lâm Uyển Nhi"
                        className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>

                    {/* Giới Tính */}
                    <div className="sm:col-span-4 relative" ref={genderDropdownRef}>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Giới Tính
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsGenderDropdownOpen(!isGenderDropdownOpen)}
                        className="w-full flex items-center justify-between rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 hover:border-zinc-400 transition-colors"
                      >
                        <span className="truncate">{selectedGender.label}</span>
                        <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                      </button>

                      {isGenderDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-full rounded-xl border border-[#383a45] bg-[#1c1d22] p-1 shadow-2xl z-50">
                          {GENDER_OPTIONS.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setGender(g.id);
                                if (g.id === "Male") setVoiceGender("Male");
                                else if (g.id === "Female") setVoiceGender("Female");
                                setIsGenderDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                                gender === g.id
                                  ? "bg-zinc-800 text-white font-bold"
                                  : "text-zinc-300 hover:bg-[#282932] hover:text-white"
                              }`}
                            >
                              <span>{g.label}</span>
                              {gender === g.id && <Check className="h-3.5 w-3.5 text-zinc-300" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Danh Hiệu / Vai Trò (Full Width) */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Danh Hiệu / Vai Trò <span className="text-zinc-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Nữ Họa Sĩ Tự Do, Bác Sĩ Tâm Lý Trực Đêm, Nữ Thần Tượng..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
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
                        placeholder="Hội họa, Nuôi mèo, Dịu dàng..."
                        className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>

                    {/* Personality Prompt & Bio */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-zinc-300">
                          Tiểu Sử & Cuộc Đời Nhân Vật <span className="text-zinc-400">*</span>
                        </label>
                        <span className="text-[10px] text-zinc-500">Ngoại hình • Xuất thân • Tính cách</span>
                      </div>
                      <textarea
                        rows={7}
                        value={personalityPrompt}
                        onChange={(e) => setPersonalityPrompt(e.target.value)}
                        placeholder="Viết tiểu sử chi tiết về ngoại hình, nghề nghiệp, tính cách và những khát vọng của nhân vật..."
                        className="w-full min-h-[160px] rounded-xl border border-[#31333c] bg-[#141518] p-3.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed resize-y"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Traits Breakdown */}
              <div className="p-4 rounded-2xl bg-[#17181c] border border-[#2b2d35] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <Eye className="h-4 w-4 text-zinc-400" />
                  Đặc Điểm Nhận Diện Thị Giác (Để AI vẽ ảnh đồng nhất)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Mái Tóc</label>
                    <input
                      type="text"
                      value={hair}
                      onChange={(e) => setHair(e.target.value)}
                      placeholder="Tóc đen dài buông xõa"
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Đôi Mắt</label>
                    <input
                      type="text"
                      value={eyes}
                      onChange={(e) => setEyes(e.target.value)}
                      placeholder="Mắt màu hổ phách dịu dàng"
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Gu Trang Phục</label>
                    <input
                      type="text"
                      value={clothingStyle}
                      onChange={(e) => setClothingStyle(e.target.value)}
                      placeholder="Váy yếm trắng, áo len mỏng"
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Nét Đặc Trưng</label>
                    <input
                      type="text"
                      value={visualTraits}
                      onChange={(e) => setVisualTraits(e.target.value)}
                      placeholder="Nốt ruồi nhỏ dưới khóe mắt"
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
                    placeholder="Thành Phố Hà Nội Hiện Đại / Cửu Châu Đại Lục"
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Quy Tắc Vật Lý / Sức Mạnh Tùy Biến</label>
                  <input
                    type="text"
                    value={customPhysicsRules}
                    onChange={(e) => setCustomPhysicsRules(e.target.value)}
                    placeholder="Tuân thủ quy tắc vật lý đời thường, không có phép thuật"
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
                  placeholder="Mô tả bối cảnh xã hội, khí hậu, thời đại và các thế lực đang tranh đoạt..."
                  className="w-full rounded-2xl border border-[#31333c] bg-[#141518] p-3 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PSYCHOLOGY & BOUNDARIES */}
          {activeTab === "psychology" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-[#17181c] border border-[#2b2d35]">
                <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 mb-1">
                  <Brain className="h-4 w-4 text-zinc-400" /> Bản Thiết Kế Tâm Lý & Lòng Tự Trọng (Anti-Sycophancy)
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Giúp nhân vật có lập trường độc lập, từ chối nịnh bợ mù quáng và có phản ứng tự nhiên khi bị xúc phạm hoặc trêu chọc.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Khát Vọng Thầm Kín (Desires)</label>
                  <input
                    type="text"
                    value={desires}
                    onChange={(e) => setDesires(e.target.value)}
                    placeholder="Mở một phòng tranh riêng, tìm được tri kỷ thấu hiểu"
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Nỗi Sợ Sâu Nhất (Fears)</label>
                  <input
                    type="text"
                    value={fears}
                    onChange={(e) => setFears(e.target.value)}
                    placeholder="Sợ sự phản bội, sợ bị lãng quên trong cô độc"
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Phản Ứng Khi Tức Giận / Bị Xúc Phạm</label>
                  <input
                    type="text"
                    value={whenAngry}
                    onChange={(e) => setWhenAngry(e.target.value)}
                    placeholder="Lạnh lùng im lặng, ánh mắt sắc lạnh và giữ khoảng cách"
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Phản Ứng Khi Vui Vẻ / Được Khen</label>
                  <input
                    type="text"
                    value={whenHappy}
                    onChange={(e) => setWhenHappy(e.target.value)}
                    placeholder="Đôi mắt cong lại cười dịu dàng, khẽ đỏ mặt ngượng ngùng"
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Ranh Giới Đỏ Cá Nhân (Personal Boundaries)</label>
                <input
                  type="text"
                  value={boundaries}
                  onChange={(e) => setBoundaries(e.target.value)}
                  placeholder="Không chấp nhận kẻ dối trá; Tuyệt đối từ chối đụng chạm khi chưa thân thiết"
                  className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: LOREBOOK */}
          {activeTab === "lorebook" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-[#17181c] border border-[#2b2d35]">
                <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 mb-1">
                  <BookOpen className="h-4 w-4 text-zinc-400" /> Bách Khoa Tri Thức Thế Giới (World Lorebook)
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Ghi nhớ các địa danh, tổ chức, thần vật hoặc truyền thuyết. Khi nhắc đến từ khóa, AI sẽ tự động kích hoạt tri thức này!
                </p>
              </div>

              {/* Add Lorebook Item */}
              <div className="p-4 rounded-2xl bg-[#141518] border border-[#2b2d35] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Tiêu Đề Tri Thức</label>
                    <input
                      type="text"
                      value={newLoreTitle}
                      onChange={(e) => setNewLoreTitle(e.target.value)}
                      placeholder="Phòng Tranh Mưa Đêm"
                      className="w-full rounded-lg border border-[#31333c] bg-[#111215] px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Từ Khóa Kích Hoạt (Cách nhau bằng dấu phẩy)</label>
                    <input
                      type="text"
                      value={newLoreKeywords}
                      onChange={(e) => setNewLoreKeywords(e.target.value)}
                      placeholder="phòng tranh, tranh vẽ, triển lãm"
                      className="w-full rounded-lg border border-[#31333c] bg-[#111215] px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Nội Dung Tri Thức Chi Tiết</label>
                  <textarea
                    rows={2}
                    value={newLoreContent}
                    onChange={(e) => setNewLoreContent(e.target.value)}
                    placeholder="Mô tả về nơi này hoặc sự kiện này đối với nhân vật..."
                    className="w-full rounded-lg border border-[#31333c] bg-[#111215] p-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddLorebook}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#26272e] border border-[#383a45] text-zinc-200 hover:bg-[#30323c] text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Thêm Mục Tri Thức
                </button>
              </div>

              {/* Lorebook List */}
              <div className="space-y-2">
                {lorebookEntries.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#17181c] border border-[#2b2d35] flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                        {item.title}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#272832] text-zinc-400 font-normal">
                          Từ khóa: {item.keywords.join(", ")}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLorebook(idx)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: INTIMACY & VOICE */}
          {activeTab === "intimacy" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Điểm Thiện Cảm Ban Đầu: <span className="text-zinc-100">{defaultAffectionScore}</span> / 100
                  </label>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={defaultAffectionScore}
                    onChange={(e) => setDefaultAffectionScore(Number(e.target.value))}
                    className="w-full accent-zinc-200 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>-100 (Thù địch)</span>
                    <span>0 (Người lạ)</span>
                    <span>100 (Tri kỷ)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Tâm Trạng Khởi Đầu</label>
                  <input
                    type="text"
                    value={defaultMood}
                    onChange={(e) => setDefaultMood(e.target.value)}
                    placeholder="Lạnh lùng & Đề phòng / Dịu dàng"
                    className="w-full rounded-xl border border-[#31333c] bg-[#141518] px-3.5 py-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Voice Profile */}
              <div className="p-4 rounded-2xl bg-[#17181c] border border-[#2b2d35] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <Volume2 className="h-4 w-4 text-zinc-400" />
                  Hồ Sơ Giọng Nói AI (TTS Engine)
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
                      placeholder="Dịu dàng, trầm ấm, ngọt ngào..."
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
                    <span>Hoàn Tất & Khởi Tạo Nhân Vật</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Avatar Cropper Modal */}
        {isCropperOpen && rawAvatarImage && (
          <ImageCropperModal
            isOpen={isCropperOpen}
            imageSrc={rawAvatarImage}
            cropShape="round"
            title="Cắt & Căn chỉnh ảnh đại diện (1:1)"
            onSave={(croppedUrl: string) => {
              setAvatarUrl(croppedUrl);
              setIsCropperOpen(false);
            }}
            onClose={() => setIsCropperOpen(false)}
          />
        )}

        {/* Full-Body Cropper Modal */}
        {isFullBodyCropperOpen && rawFullBodyImage && (
          <ImageCropperModal
            isOpen={isFullBodyCropperOpen}
            imageSrc={rawFullBodyImage}
            cropShape="rect"
            outputWidth={512}
            outputHeight={768}
            title="Cắt & Căn chỉnh ảnh toàn thân (2:3)"
            onSave={(croppedUrl: string) => {
              setFullBodyUrl(croppedUrl);
              setIsFullBodyCropperOpen(false);
            }}
            onClose={() => setIsFullBodyCropperOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
