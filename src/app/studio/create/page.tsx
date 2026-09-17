"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Character,
  CreateCharacterRequest,
  RelationshipMilestone,
  WorldGenre,
  CharacterBlueprint,
  CharacterVisualIdentity,
  CharacterVoiceProfile,
  CreateLorebookEntryDto,
} from "@/types";
import { createCharacter, generateCharacterWithAi, fetchAiRandomIdeas, generateCharacterAvatar, generateCharacterStandee, resolveMediaUrl } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { CharacterCard } from "@/components/characters/CharacterCard";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";
import RelationshipMilestonesEditor from "@/components/characters/RelationshipMilestonesEditor";
import { WORLD_GENRE_OPTIONS, getWorldGenreMeta, VISUAL_STYLE_OPTIONS, normalizeVisualStyle } from "@/lib/constants";
import { useAuth } from "@/core/providers/AuthProvider";
import {
  ArrowLeft,
  Sparkles,
  Wand2,
  Heart,
  ChevronDown,
  Check,
  Loader2,
  Upload,
  RotateCcw,
  Lightbulb,
  Globe,
  Image as ImageIcon,
  Brain,
  BookOpen,
  Volume2,
  Eye,
  Plus,
  Trash2,
  UserCheck,
  Crop,
} from "lucide-react";
import Link from "next/link";

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

const GENDER_OPTIONS = [
  { id: "Female", label: "Nữ" },
  { id: "Male", label: "Nam" },
  { id: "Other", label: "Khác / Vô tính" },
];

export default function CreateCharacterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, openAuthModal } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      openAuthModal();
      router.push("/studio");
    }
  }, [isAuthLoading, isAuthenticated, router, openAuthModal]);

  // AI Generator state
  const [aiIdea, setAiIdea] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [inspirationSuggestions, setInspirationSuggestions] = useState<string[]>(INSPIRATION_IDEAS.slice(0, 3));
  const [isRefreshingIdeas, setIsRefreshingIdeas] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [gender, setGender] = useState("Female");
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef<HTMLDivElement>(null);
  const [visualStyle, setVisualStyle] = useState("Anime");
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const [isAiStyleDropdownOpen, setIsAiStyleDropdownOpen] = useState(false);
  const aiStyleDropdownRef = useRef<HTMLDivElement>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [rawAvatarImage, setRawAvatarImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [fullBodyUrl, setFullBodyUrl] = useState("");
  const [rawFullBodyImage, setRawFullBodyImage] = useState<string | null>(null);
  const [isFullBodyCropperOpen, setIsFullBodyCropperOpen] = useState(false);
  const fullBodyFileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isGeneratingStandee, setIsGeneratingStandee] = useState(false);
  const [personalityPrompt, setPersonalityPrompt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Visual Identity (8 Dimensional Attributes)
  const [hair, setHair] = useState("");
  const [eyes, setEyes] = useState("");
  const [face, setFace] = useState("");
  const [ageAppearance, setAgeAppearance] = useState("");
  const [skin, setSkin] = useState("");
  const [body, setBody] = useState("");
  const [clothingStyle, setClothingStyle] = useState("");
  const [accessories, setAccessories] = useState("");
  const [visualTraits, setVisualTraits] = useState("");

  // World & Universe
  const [worldGenre, setWorldGenre] = useState<WorldGenre>(WorldGenre.MundaneSliceOfLife);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const [customGenreName, setCustomGenreName] = useState("");
  const [worldName, setWorldName] = useState("");
  const [worldDescription, setWorldDescription] = useState("");
  const [customPhysicsRules, setCustomPhysicsRules] = useState("");
  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const voiceDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setIsGenreDropdownOpen(false);
      }
      if (voiceDropdownRef.current && !voiceDropdownRef.current.contains(event.target as Node)) {
        setIsVoiceDropdownOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target as Node)) {
        setIsGenderDropdownOpen(false);
      }
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(event.target as Node)) {
        setIsStyleDropdownOpen(false);
      }
      if (aiStyleDropdownRef.current && !aiStyleDropdownRef.current.contains(event.target as Node)) {
        setIsAiStyleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Psychology Blueprint
  const [desires, setDesires] = useState("");
  const [fears, setFears] = useState("");
  const [whenAngry, setWhenAngry] = useState("");
  const [whenHappy, setWhenHappy] = useState("");
  const [antiSycophancy, setAntiSycophancy] = useState("");
  const [boundaries, setBoundaries] = useState("");

  // Lorebook Entries
  const [lorebookEntries, setLorebookEntries] = useState<CreateLorebookEntryDto[]>([]);
  const [newLoreTitle, setNewLoreTitle] = useState("");
  const [newLoreContent, setNewLoreContent] = useState("");
  const [newLoreKeywords, setNewLoreKeywords] = useState("");

  // Intimacy & Voice
  const [defaultAffectionScore, setDefaultAffectionScore] = useState<number>(0);
  const [defaultMood, setDefaultMood] = useState<string>("");
  const [customMilestones, setCustomMilestones] = useState<RelationshipMilestone[]>([]);
  const [voiceGender, setVoiceGender] = useState("Female");
  const [voiceTone, setVoiceTone] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRefreshSuggestions = async () => {
    try {
      setIsRefreshingIdeas(true);
      const res = await fetchAiRandomIdeas(3);
      if (res && res.length > 0) {
        setInspirationSuggestions(res.slice(0, 3));
      } else {
        const shuffled = [...INSPIRATION_IDEAS].sort(() => 0.5 - Math.random());
        setInspirationSuggestions(shuffled.slice(0, 3));
      }
    } catch {
      const shuffled = [...INSPIRATION_IDEAS].sort(() => 0.5 - Math.random());
      setInspirationSuggestions(shuffled.slice(0, 3));
    } finally {
      setIsRefreshingIdeas(false);
    }
  };

  const selectedGenre = getWorldGenreMeta(worldGenre);
  const selectedGender = GENDER_OPTIONS.find((g) => g.id === gender) || GENDER_OPTIONS[0];
  const selectedStyle = VISUAL_STYLE_OPTIONS.find((s) => s.id === visualStyle) || VISUAL_STYLE_OPTIONS[0];

  const handleGenerateWithAi = async (ideaToUse?: string) => {
    const textToGenerate = (ideaToUse || aiIdea).trim();
    if (!textToGenerate) {
      setError("Vui lòng nhập ý tưởng nhân vật để AI phác thảo!");
      return;
    }

    try {
      setIsGeneratingAi(true);
      setError(null);
      const data = await generateCharacterWithAi(textToGenerate, undefined, visualStyle);

      if (data) {
        setName(data.name || "");
        setTitle(data.title || "");
        setPersonalityPrompt(data.personalityPrompt || "");
        setTagsInput(data.tags?.join(", ") || "");
        setDefaultAffectionScore(data.defaultAffectionScore ?? 0);
        setDefaultMood(data.defaultMood || "Bình thường");

        if (data.worldGenre !== undefined && data.worldGenre !== null) {
          if (typeof data.worldGenre === "number") {
            setWorldGenre(data.worldGenre as WorldGenre);
          } else if (typeof data.worldGenre === "string") {
            const parsedNum = Number(data.worldGenre);
            if (!isNaN(parsedNum)) {
              setWorldGenre(parsedNum as WorldGenre);
            } else {
              const gStr = (data.worldGenre as string).toLowerCase();
              if (gStr.includes("fantasy") || gStr.includes("tiên") || gStr.includes("kiếm")) setWorldGenre(WorldGenre.HighFantasy);
              else if (gStr.includes("urban") || gStr.includes("supernatural") || gStr.includes("dị năng") || gStr.includes("siêu")) setWorldGenre(WorldGenre.UrbanSupernatural);
              else if (gStr.includes("cyber") || gStr.includes("sci") || gStr.includes("viễn tưởng") || gStr.includes("tương lai")) setWorldGenre(WorldGenre.CyberpunkSciFi);
              else if (gStr.includes("history") || gStr.includes("historical") || gStr.includes("cổ trang") || gStr.includes("lịch sử")) setWorldGenre(WorldGenre.Historical);
              else if (gStr.includes("custom") || gStr.includes("tự do")) setWorldGenre(WorldGenre.Custom);
              else setWorldGenre(WorldGenre.MundaneSliceOfLife);
            }
          }
        }
        setWorldName(data.worldName || "");
        setWorldDescription(data.worldDescription || "");
        setCustomPhysicsRules(data.customPhysicsRules || "");

        // Visual Identity (8 Fields + Gender + Style)
        if (data.visualIdentity) {
          if (data.visualIdentity.style) {
            setVisualStyle(normalizeVisualStyle(data.visualIdentity.style));
          } else if (data.visualIdentity.visualStyle) {
            setVisualStyle(normalizeVisualStyle(data.visualIdentity.visualStyle));
          }
          if (data.visualIdentity.gender) {
            setGender(data.visualIdentity.gender);
            if (data.visualIdentity.gender === "Male") setVoiceGender("Male");
            else if (data.visualIdentity.gender === "Female") setVoiceGender("Female");
          }
          setHair(data.visualIdentity.hair || "");
          setEyes(data.visualIdentity.eyes || "");
          setFace(data.visualIdentity.face || "");
          setAgeAppearance(data.visualIdentity.ageAppearance || "");
          setSkin(data.visualIdentity.skin || "");
          setBody(data.visualIdentity.body || "");
          setClothingStyle(data.visualIdentity.clothingStyle || "");
          setAccessories(data.visualIdentity.accessories || "");
          if (data.visualIdentity.visualTraits) {
            setVisualTraits(data.visualIdentity.visualTraits);
          }
          if (data.visualIdentity.fullBodyUrl) {
            setFullBodyUrl(data.visualIdentity.fullBodyUrl);
          } else if (data.visualIdentity.canonicalReferenceUrl) {
            setFullBodyUrl(data.visualIdentity.canonicalReferenceUrl);
          }
        }

        // Voice Profile
        if (data.voiceProfile) {
          if (data.voiceProfile.gender) {
            setVoiceGender(data.voiceProfile.gender === "Male" ? "Male" : "Female");
          }
          if (data.voiceProfile.tone) {
            setVoiceTone(data.voiceProfile.tone);
          }
        }

        // Relationship Milestones (Auto-populate)
        if (data.customMilestones && data.customMilestones.length > 0) {
          setCustomMilestones(data.customMilestones);
        }

        if (data.blueprint) {
          setDesires(data.blueprint.psychology?.desires || "");
          setFears(data.blueprint.psychology?.fears || "");
          setWhenAngry(data.blueprint.behavior?.whenAngry || "");
          setWhenHappy(data.blueprint.behavior?.whenHappy || "");
          setAntiSycophancy(data.blueprint.rules?.antiSycophancy || "");
          setBoundaries(data.blueprint.rules?.boundaries?.join("; ") || "");
        }

        if (data.initialLorebookEntries && data.initialLorebookEntries.length > 0) {
          setLorebookEntries(
            data.initialLorebookEntries.map((e) => ({
              title: e.title,
              content: e.content,
              keywords: e.keywords,
              category: e.category,
              isConstant: e.isConstant,
              priority: e.priority,
            }))
          );
        }

        if (!avatarUrl) {
          handleGenerateBothImagesAi(
            data.name,
            data.title,
            data.personalityPrompt,
            {
              ...(data.visualIdentity || {}),
              style: visualStyle,
              visualStyle: visualStyle,
            },
            data.worldGenre !== undefined ? Number(data.worldGenre) : undefined
          );
        }
      }
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      setError(err.message || "Không thể tạo nhân vật bằng AI. Vui lòng thử lại!");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const canGenerateAvatar = Boolean(name.trim() && title.trim() && personalityPrompt.trim());

  const handleGenerateAvatarAi = async (
    customName?: string,
    customTitle?: string,
    customBio?: string,
    customVisualIdentity?: CharacterVisualIdentity,
    customWorldGenre?: WorldGenre | number
  ) => {
    if (isGeneratingAvatar || isGeneratingStandee) return;
    const targetName = (customName || name).trim();
    const targetTitle = (customTitle || title).trim();
    const targetBio = (customBio || personalityPrompt).trim();
    const normalizedStyle = normalizeVisualStyle(
      customVisualIdentity?.style || customVisualIdentity?.visualStyle || visualStyle
    );
    const targetVisualIdentity: CharacterVisualIdentity = {
      ...(customVisualIdentity || {
        gender,
        hair,
        eyes,
        face,
        ageAppearance,
        skin,
        body,
        clothingStyle,
        accessories,
        visualTraits,
      }),
      style: normalizedStyle,
      visualStyle: normalizedStyle,
    };
    const targetWorldGenre = customWorldGenre !== undefined ? customWorldGenre : worldGenre;

    if (!targetName || !targetTitle || !targetBio) {
      setError("Vui lòng điền đầy đủ Tên Nhân Vật, Danh Hiệu và Tiểu Sử để AI có đủ dữ kiện vẽ ảnh chân dung chính xác!");
      return;
    }

    try {
      setIsGeneratingAvatar(true);
      setError(null);
      const res = await generateCharacterAvatar({
        name: targetName,
        title: targetTitle,
        personalityPrompt: targetBio,
        worldGenre: targetWorldGenre,
        visualIdentity: targetVisualIdentity,
      });

      let newlyGeneratedAvatarUrl: string | null = null;
      if (res?.avatarUrl) {
        newlyGeneratedAvatarUrl = res.avatarUrl;
        setAvatarUrl(res.avatarUrl);
        setRawAvatarImage(res.avatarUrl);
      }

      // Auto-chain standee generation so standee is always synchronized with the newly generated avatar
      if (newlyGeneratedAvatarUrl) {
        try {
          setIsGeneratingAvatar(false);
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
        } catch (standeeErr) {
          console.warn("Auto-generate standee failed after avatar generation:", standeeErr);
          setError("Đã vẽ ảnh chân dung thành công nhưng chưa thể tạo dáng đứng. Bạn có thể bấm vẽ lại dáng đứng!");
        } finally {
          setIsGeneratingStandee(false);
        }
      }
    } catch {
      setError("Không thể vẽ ảnh chân dung tự động. Vui lòng thử lại hoặc tải ảnh từ máy!");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleGenerateStandeeAi = async (
    customName?: string,
    customTitle?: string,
    customBio?: string,
    customVisualIdentity?: CharacterVisualIdentity,
    customWorldGenre?: WorldGenre | number,
    customAvatarUrl?: string
  ) => {
    if (isGeneratingStandee || isGeneratingAvatar) return;
    const targetName = (customName || name).trim();
    const targetTitle = (customTitle || title).trim();
    const targetBio = (customBio || personalityPrompt).trim();
    const normalizedStyle = normalizeVisualStyle(
      customVisualIdentity?.style || customVisualIdentity?.visualStyle || visualStyle
    );
    const targetVisualIdentity: CharacterVisualIdentity = {
      ...(customVisualIdentity || {
        gender,
        hair,
        eyes,
        face,
        ageAppearance,
        skin,
        body,
        clothingStyle,
        accessories,
        visualTraits,
      }),
      style: normalizedStyle,
      visualStyle: normalizedStyle,
    };
    const targetWorldGenre = customWorldGenre !== undefined ? customWorldGenre : worldGenre;
    const refAvatar = customAvatarUrl || avatarUrl;

    if (!targetName || !targetTitle || !targetBio) {
      setError("Vui lòng điền đầy đủ Tên Nhân Vật, Danh Hiệu và Tiểu Sử để AI có đủ dữ kiện vẽ ảnh dáng đứng chính xác!");
      return;
    }

    try {
      setIsGeneratingStandee(true);
      setError(null);
      const res = await generateCharacterStandee({
        name: targetName,
        title: targetTitle,
        personalityPrompt: targetBio,
        worldGenre: targetWorldGenre,
        visualIdentity: targetVisualIdentity,
        avatarUrl: refAvatar || undefined,
        referenceImageUrl: refAvatar || undefined,
      });

      if (res?.standeeUrl) {
        setFullBodyUrl(res.standeeUrl);
        setRawFullBodyImage(res.standeeUrl);
      }
    } catch {
      setError("Không thể vẽ ảnh dáng đứng tự động. Vui lòng thử lại hoặc tải ảnh từ máy!");
    } finally {
      setIsGeneratingStandee(false);
    }
  };

  const handleGenerateBothImagesAi = async (
    customName?: string,
    customTitle?: string,
    customBio?: string,
    customVisualIdentity?: CharacterVisualIdentity,
    customWorldGenre?: WorldGenre | number
  ) => {
    await handleGenerateAvatarAi(
      customName,
      customTitle,
      customBio,
      customVisualIdentity,
      customWorldGenre
    );
  };

  const handleAddLorebookEntry = () => {
    if (!newLoreTitle.trim() || !newLoreContent.trim()) return;
    const keywords = newLoreKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    setLorebookEntries((prev) => [
      ...prev,
      {
        title: newLoreTitle.trim(),
        content: newLoreContent.trim(),
        keywords: keywords.length > 0 ? keywords : [newLoreTitle.trim()],
        category: 0,
        isConstant: false,
        priority: 100,
      },
    ]);
    setNewLoreTitle("");
    setNewLoreContent("");
    setNewLoreKeywords("");
  };

  const handleRemoveLorebookEntry = (idx: number) => {
    setLorebookEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

      const normalizedStyle = normalizeVisualStyle(visualStyle);
      const visualIdentity: CharacterVisualIdentity = {
        gender: gender || undefined,
        style: normalizedStyle,
        visualStyle: normalizedStyle,
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
        canonicalReferenceUrl: avatarUrl.trim() || fullBodyUrl.trim() || undefined,
      };

      const voiceProfile: CharacterVoiceProfile = {
        voiceId: "vi-VN-HoaiMyNeural",
        gender: voiceGender,
        tone: voiceTone,
      };

      const req: CreateCharacterRequest = {
        name: name.trim(),
        title: title.trim(),
        avatarUrl: avatarUrl.trim(),
        personalityPrompt: personalityPrompt.trim(),
        greeting: "",
        tags: parsedTags,
        isPublic,
        defaultAffectionScore,
        defaultMood: defaultMood.trim() || "Bình thường",
        worldGenre,
        worldName: (worldName.trim() || (worldGenre === WorldGenre.Custom ? customGenreName.trim() : "")) || undefined,
        worldDescription: worldDescription.trim() || undefined,
        customPhysicsRules: (
          customPhysicsRules.trim() +
          (worldGenre === WorldGenre.Custom && customGenreName.trim() ? ` [Thể loại thế giới: ${customGenreName.trim()}]` : "")
        ).trim() || undefined,
        blueprint,
        visualIdentity,
        voiceProfile,
        customMilestones: customMilestones.length > 0 ? customMilestones : undefined,
        initialLorebookEntries: lorebookEntries.length > 0 ? lorebookEntries : undefined,
      };

      await createCharacter(req);
      router.push("/studio");
    } catch (err: any) {
      console.error("Create character failed:", err);
      setError(err.message || "Tạo nhân vật thất bại. Vui lòng kiểm tra lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#121316] text-zinc-100 font-sans overflow-hidden">
      <Header />

      {/* Main Studio Workspace (2 Columns) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          
          {/* Top Title Bar */}
          <div className="flex items-center gap-3.5 pb-6 border-b border-[#2c2e35] mb-8">
            <Link
              href="/studio"
              className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-100 bg-[#1e1f25] hover:bg-[#282932] border border-[#2e303a] transition-all"
              title="Quay lại Studio"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight">
                Tạo Nhân Vật Mới
              </h1>
              <p className="text-xs text-zinc-400">
                Thiết lập danh tính, ngoại hình, bối cảnh thế giới và tính cách độc lập cho AI
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-950/30 border border-red-500/30 text-xs sm:text-sm text-red-300 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* AI Quick Architect Generator Banner */}
          <div className="mb-8 rounded-3xl border border-[#383a45] bg-[#212227] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-[#2c2e35]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-zinc-100 text-zinc-950 font-bold shadow-md">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-zinc-100">
                    Kiến Trúc Sư AI (Khởi Tạo Nhanh)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Nhập ý tưởng ngắn gọn, AI sẽ tự động phác thảo danh tính, tâm lý và 8 mốc quan hệ
                  </p>
                </div>
              </div>
            </div>

            {/* Omnibar Input Card */}
            <div className="rounded-2xl border border-[#383a45] bg-[#18191c] p-3.5 sm:p-4 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400 transition-all shadow-inner">
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
                placeholder="Nhập ý tưởng phác thảo nhân vật (VD: Nữ kiếm sĩ tsundere đến từ vương quốc tuyết rơi, ngoài lạnh trong ấm...)"
                className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
              />

              {/* Omnibar Bottom Toolbar */}
              <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-[#26272e]">
                {/* Visual Style Dropdown Selector */}
                <div className="relative" ref={aiStyleDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsAiStyleDropdownOpen(!isAiStyleDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#222329] hover:bg-[#2c2d35] border border-[#343640] text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm"
                  >
                    <span className="text-sm">{selectedStyle.id === "Anime" ? "🎨" : "📷"}</span>
                    <span>{selectedStyle.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isAiStyleDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isAiStyleDropdownOpen && (
                    <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl border border-[#383a45] bg-[#1c1d22] p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
                      <div className="text-[10px] font-bold text-zinc-400 px-3 py-1 uppercase tracking-wider">
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
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-base shrink-0">{s.id === "Anime" ? "🎨" : "📷"}</span>
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-100">{s.label}</div>
                                <div className="text-[10px] text-zinc-400 truncate mt-0.5">{s.desc}</div>
                              </div>
                            </div>
                            {visualStyle === s.id && <Check className="h-3.5 w-3.5 text-zinc-300 shrink-0 ml-1.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={() => handleGenerateWithAi()}
                  disabled={isGeneratingAi || !aiIdea.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 px-5 py-2 text-xs sm:text-sm font-bold shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                      <span>AI Đang Phác Thảo...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      <span>Tự Động Sinh 7 Đặc Tính</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inspiration Chips */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 mr-1">
                <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                Gợi ý nhanh:
              </span>
              {inspirationSuggestions.map((idea, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAiIdea(idea);
                    handleGenerateWithAi(idea);
                  }}
                  className="text-left text-[11px] px-3 py-1 rounded-xl bg-[#18191c] hover:bg-[#2b2c34] text-zinc-300 border border-[#31333a] hover:border-zinc-400 transition-all cursor-pointer truncate max-w-xs"
                  title={idea}
                >
                  {idea}
                </button>
              ))}

              <button
                type="button"
                onClick={handleRefreshSuggestions}
                disabled={isRefreshingIdeas}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-[#2b2c34] transition-colors"
                title="Đổi gợi ý khác"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRefreshingIdeas ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* 2 Columns: Form on Left (75%), Live Preview on Right (25%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: The Detailed Editor Form */}
            <div className="lg:col-span-9 space-y-6">
              
              {/* SECTION 1: Profile & Visual */}
              <div className="rounded-3xl border border-[#31333a] bg-[#212227] p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-[#2c2e35]">
                  <UserCheck className="h-5 w-5 text-zinc-300" />
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                    1. Hồ Sơ Danh Tính & Ngoại Hình
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
                  {/* Dual Image Upload: Avatar + Full-Body */}
                  <div className="sm:col-span-5 flex flex-col p-5 rounded-2xl bg-[#18191c] border border-[#2b2c34] shadow-sm">
                    <div className="grid grid-cols-2 gap-4 items-stretch">
                      {/* Box 1: Avatar */}
                      <div className="flex flex-col items-center justify-between h-full">
                        <label className="text-xs font-bold text-zinc-300 mb-2">Ảnh Chân Dung</label>
                        <div className="flex-1 flex items-center justify-center py-1">
                          <div
                            onClick={() => {
                              if (avatarUrl && !isGeneratingAvatar) {
                                setRawAvatarImage(avatarUrl);
                                setIsCropperOpen(true);
                              } else if (!isGeneratingAvatar) {
                                fileInputRef.current?.click();
                              }
                            }}
                            className="relative w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-full overflow-hidden bg-[#24252a] border-2 border-[#3b3d46] hover:border-zinc-300 flex items-center justify-center cursor-pointer transition-all group shadow-inner ring-2 ring-black/40"
                          >
                            {isGeneratingAvatar && (
                              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white text-xs z-20 p-1 text-center">
                                <Loader2 className="h-5 w-5 animate-spin text-zinc-300 mb-1" />
                                <span className="text-[10px] text-zinc-300 leading-tight">Đang vẽ...</span>
                              </div>
                            )}
                            {avatarUrl ? (
                              <>
                                <img src={resolveMediaUrl(avatarUrl)} alt="Chân dung" className="w-full h-full object-cover" />
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
                        </div>

                        <div className="flex items-center gap-2 mt-5">
                          <button
                            type="button"
                            onClick={() => handleGenerateAvatarAi()}
                            disabled={isGeneratingAvatar || isGeneratingStandee || !canGenerateAvatar}
                            className="p-1.5 rounded-lg bg-[#2b2c34] hover:bg-[#353740] border border-[#3b3d46] text-zinc-300 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
                            title="Vẽ lại ảnh chân dung bằng AI (Dáng đứng sẽ tự động vẽ theo để đồng bộ)"
                          >
                            <Wand2 className="h-3.5 w-3.5 text-zinc-300" />
                          </button>
                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setRawAvatarImage(avatarUrl);
                                setIsCropperOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#2b2c34] hover:bg-[#353740] border border-[#3b3d46] text-zinc-300 hover:text-white transition-all cursor-pointer"
                              title="Căn chỉnh / Cắt lại ảnh chân dung"
                            >
                              <Crop className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 rounded-lg bg-[#2b2c34] hover:bg-[#353740] border border-[#3b3d46] text-zinc-300 hover:text-white transition-all cursor-pointer"
                            title="Tải ảnh chân dung từ máy"
                          >
                            <Upload className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Box 2: Full-Body */}
                      <div className="flex flex-col items-center justify-between h-full">
                        <label className="text-xs font-bold text-zinc-300 mb-2">Ảnh Dáng Đứng</label>
                        <div className="flex-1 flex items-center justify-center py-1 w-full">
                          <div
                            onClick={() => {
                              if (fullBodyUrl && !isGeneratingStandee && !isGeneratingAvatar) {
                                setRawFullBodyImage(fullBodyUrl);
                                setIsFullBodyCropperOpen(true);
                              } else if (!isGeneratingStandee && !isGeneratingAvatar) {
                                fullBodyFileInputRef.current?.click();
                              }
                            }}
                            className="relative w-full max-w-[140px] sm:max-w-[160px] aspect-[2/3] rounded-2xl overflow-hidden bg-[#24252a] border-2 border-[#3b3d46] hover:border-zinc-300 flex items-center justify-center cursor-pointer transition-all group shadow-inner ring-2 ring-black/40"
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
                                <img src={resolveMediaUrl(fullBodyUrl)} alt="Dáng đứng" className="w-full h-full object-cover object-top" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
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
                        </div>

                        <div className="flex items-center gap-2 mt-5">
                          <button
                            type="button"
                            onClick={() => handleGenerateStandeeAi()}
                            disabled={isGeneratingAvatar || isGeneratingStandee || !canGenerateAvatar}
                            className="p-1.5 rounded-lg bg-[#2b2c34] hover:bg-[#353740] border border-[#3b3d46] text-zinc-300 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
                            title="Vẽ lại ảnh dáng đứng theo chân dung hiện tại"
                          >
                            <Wand2 className="h-3.5 w-3.5 text-zinc-300" />
                          </button>
                          {fullBodyUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setRawFullBodyImage(fullBodyUrl);
                                setIsFullBodyCropperOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#2b2c34] hover:bg-[#353740] border border-[#3b3d46] text-zinc-300 hover:text-white transition-all cursor-pointer"
                              title="Căn chỉnh / Cắt lại ảnh dáng đứng"
                            >
                              <Crop className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => fullBodyFileInputRef.current?.click()}
                            className="p-1.5 rounded-lg bg-[#2b2c34] hover:bg-[#353740] border border-[#3b3d46] text-zinc-300 hover:text-white transition-all cursor-pointer"
                            title="Tải ảnh dáng đứng từ máy"
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
                    <div className="w-full mt-6">
                      <button
                        type="button"
                        onClick={() => handleGenerateBothImagesAi()}
                        disabled={isGeneratingAvatar || isGeneratingStandee || !canGenerateAvatar}
                        title={
                          !canGenerateAvatar
                            ? "Vui lòng điền Tên, Danh hiệu và Tiểu sử trước khi vẽ ảnh"
                            : "AI phân tích mô tả và vẽ cả 2 ảnh: Chân dung & Dáng đứng đồng bộ"
                        }
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#2b2c34] border border-[#3b3d46] text-zinc-200 hover:bg-[#353740] disabled:opacity-35 disabled:hover:bg-[#2b2c34] disabled:cursor-not-allowed text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-sm"
                      >
                        {isGeneratingAvatar || isGeneratingStandee ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />
                            {isGeneratingAvatar
                              ? "AI Đang Vẽ Chân Dung..."
                              : "AI Đang Vẽ Dáng Đứng..."}
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

                  {/* Info inputs */}
                  <div className="sm:col-span-7 flex flex-col space-y-3.5">
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
                          className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
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
                          className="w-full flex items-center justify-between rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 hover:border-zinc-400 transition-colors"
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

                    {/* Row 2: Danh Hiệu / Nghề Nghiệp & Phong Cách Visual */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-7">
                        <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                          Danh Hiệu / Nghề Nghiệp <span className="text-zinc-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Nữ Họa Sĩ Tự Do, Bác Sĩ Tâm Lý Trực Đêm..."
                          className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                        />
                      </div>

                      {/* Phong Cách Visual (Visual Style: Hoạt Họa ↔ Chân Thực) */}
                      <div className="sm:col-span-5 relative" ref={styleDropdownRef}>
                        <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                          Phong Cách Visual
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
                          className="w-full flex items-center justify-between rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 hover:border-zinc-400 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span className="truncate font-medium">{selectedStyle.label}</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-zinc-400 shrink-0 ml-1 transition-transform ${isStyleDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isStyleDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-full rounded-xl border border-[#383a45] bg-[#1c1d22] p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1">
                            <div className="space-y-1">
                              {VISUAL_STYLE_OPTIONS.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setVisualStyle(s.id);
                                    setIsStyleDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                    visualStyle === s.id
                                      ? "bg-zinc-800 text-white font-bold"
                                      : "text-zinc-300 hover:bg-[#282932] hover:text-white"
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="font-medium text-xs text-zinc-100">
                                      {s.label}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 font-normal truncate mt-0.5">
                                      {s.desc}
                                    </div>
                                  </div>
                                  {visualStyle === s.id && <Check className="h-3.5 w-3.5 text-zinc-300 shrink-0" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Thẻ Từ Khóa */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">Thẻ Từ Khóa</label>
                      <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="Hội họa, Nuôi mèo, Dịu dàng, Thích uống trà..."
                        className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>

                    {/* Row 4: Tiểu Sử & Cuộc Sống Thường Nhật */}
                    <div className="flex flex-col">
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Tiểu Sử & Cuộc Sống Thường Nhật <span className="text-zinc-400">*</span>
                      </label>
                      <textarea
                        value={personalityPrompt}
                        onChange={(e) => setPersonalityPrompt(e.target.value)}
                        placeholder="Mô tả hoàn cảnh sống, tính cách, cách xưng hô và những điều nhân vật hay làm khi rảnh rỗi..."
                        rows={5}
                        className="w-full rounded-xl border border-[#31333c] bg-[#16171b] p-3.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed placeholder-zinc-600 resize-y"
                      />
                    </div>
                  </div>
                </div>

                {/* Visual Identity Breakdown (8 Attributes) */}
                <div className="p-4 rounded-2xl bg-[#18191c] border border-[#2b2c34] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <Eye className="h-4 w-4 text-zinc-400" />
                    Đặc Điểm Nhận Diện Thị Giác
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">1. Mái Tóc</label>
                      <input
                        type="text"
                        value={hair}
                        onChange={(e) => setHair(e.target.value)}
                        placeholder="Đen dài buộc lỏng, mái thưa..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">2. Đôi Mắt</label>
                      <input
                        type="text"
                        value={eyes}
                        onChange={(e) => setEyes(e.target.value)}
                        placeholder="Nâu hạt dẻ trong veo, ánh nhìn ấm..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">3. Gương Mặt</label>
                      <input
                        type="text"
                        value={face}
                        onChange={(e) => setFace(e.target.value)}
                        placeholder="Mặt trái xoan, sống mũi cao..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">4. Tuổi Ngoại Hình</label>
                      <input
                        type="text"
                        value={ageAppearance}
                        onChange={(e) => setAgeAppearance(e.target.value)}
                        placeholder="Khoảng 19-21 tuổi..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">5. Làn Da</label>
                      <input
                        type="text"
                        value={skin}
                        onChange={(e) => setSkin(e.target.value)}
                        placeholder="Trắng sứ mịn màng, má ửng hồng..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">6. Vóc Dáng & Chiều Cao</label>
                      <input
                        type="text"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Cao 1m65, 3 vòng 90-60-90, vóc dáng đồng hồ cát..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">7. Gu Trang Phục</label>
                      <input
                        type="text"
                        value={clothingStyle}
                        onChange={(e) => setClothingStyle(e.target.value)}
                        placeholder="Áo len oversize, tạp dề họa sĩ..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">8. Phụ Kiện & Dấu Ấn</label>
                      <input
                        type="text"
                        value={accessories}
                        onChange={(e) => setAccessories(e.target.value)}
                        placeholder="Kính gọng tròn, nốt ruồi mi mắt..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: World & Universe */}
              <div className="rounded-3xl border border-[#31333a] bg-[#212227] p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-[#2c2e35]">
                  <Globe className="h-5 w-5 text-zinc-300" />
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                    2. Vũ Trụ & Thế Giới Quan
                  </h3>
                </div>

                {/* World Genre Dropdown Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-2">
                    Thể Loại Thế Giới <span className="text-zinc-400">*</span>
                  </label>
                  <div className="relative" ref={genreDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)}
                      className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[#31333c] bg-[#16171b] px-4 py-3 text-left hover:border-zinc-500 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl">{selectedGenre.emoji}</span>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-zinc-100">{selectedGenre.label}</div>
                          <div className="text-[11px] text-zinc-400 truncate">{selectedGenre.desc}</div>
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform ${isGenreDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isGenreDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-[#31333a] bg-[#1c1d22] shadow-2xl z-30 p-1.5 animate-in fade-in slide-in-from-top-1">
                        <div className="max-h-72 overflow-y-auto pr-1 space-y-0.5">
                          {WORLD_GENRE_OPTIONS.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setWorldGenre(g.id);
                                setIsGenreDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                worldGenre === g.id
                                  ? "bg-[#282930] text-white font-bold"
                                  : "hover:bg-[#25262c] text-zinc-300 hover:text-white"
                              }`}
                            >
                              <span className="text-xl shrink-0">{g.emoji}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-zinc-100">{g.label}</div>
                                <div className="text-[10px] text-zinc-400 truncate">{g.desc}</div>
                              </div>
                              {worldGenre === g.id && <Check className="h-4 w-4 text-zinc-200 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Genre Input (Shows when Custom is selected) */}
                {worldGenre === WorldGenre.Custom && (
                  <div className="animate-in fade-in slide-in-from-top-1">
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Tên Thể Loại / Thế Giới Tự Do <span className="text-zinc-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={customGenreName}
                      onChange={(e) => setCustomGenreName(e.target.value)}
                      placeholder="Thế giới Hogwarts (Harry Potter), Đấu La Đại Lục, Pokemon World, SCP Foundation..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Tên Thành Phố / Vùng Đất</label>
                    <input
                      type="text"
                      value={worldName}
                      onChange={(e) => setWorldName(e.target.value)}
                      placeholder="Phố Cổ Hà Nội, Neo-Tokyo, Đại Lục Cửu Châu..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Quy Tắc Vật Lý / Sức Mạnh</label>
                    <input
                      type="text"
                      value={customPhysicsRules}
                      onChange={(e) => setCustomPhysicsRules(e.target.value)}
                      placeholder="Không phép thuật / Ma thuật cấp 10 / Trọng lực yếu..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">Mô Tả Bối Cảnh Xã Hội & Môi Trường</label>
                  <textarea
                    rows={3}
                    value={worldDescription}
                    onChange={(e) => setWorldDescription(e.target.value)}
                    placeholder="Mô tả nhịp sống xã hội, khí hậu, phong tục hoặc các sự kiện đang diễn ra trong thế giới này..."
                    className="w-full rounded-2xl border border-[#31333c] bg-[#16171b] p-3.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed placeholder-zinc-600"
                  />
                </div>
              </div>

              {/* SECTION 3: Psychology Blueprint & Boundaries */}
              <div className="rounded-3xl border border-[#31333a] bg-[#212227] p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-[#2c2e35]">
                  <Brain className="h-5 w-5 text-zinc-300" />
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                    3. Bản Thiết Kế Tâm Lý & Lòng Tự Trọng
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Khát Vọng Thầm Kín</label>
                    <input
                      type="text"
                      value={desires}
                      onChange={(e) => setDesires(e.target.value)}
                      placeholder="Muốn mở một buổi triển lãm tranh riêng..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Nỗi Sợ Sâu Nhất</label>
                    <input
                      type="text"
                      value={fears}
                      onChange={(e) => setFears(e.target.value)}
                      placeholder="Sợ bị người thân lãng quên, sợ bóng tối..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
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
                      placeholder="Im lặng, khoanh tay quay mặt đi chỗ khác..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Phản Ứng Khi Vui Vẻ</label>
                    <input
                      type="text"
                      value={whenHappy}
                      onChange={(e) => setWhenHappy(e.target.value)}
                      placeholder="Cười tít mắt, thích mời đối phương ăn bánh ngọt..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Chống Nịnh Bợ</label>
                    <input
                      type="text"
                      value={antiSycophancy}
                      onChange={(e) => setAntiSycophancy(e.target.value)}
                      placeholder="Không bao giờ hùa theo nếu người dùng nói sai sự thật..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Ranh Giới Đỏ Cá Nhân</label>
                    <input
                      type="text"
                      value={boundaries}
                      onChange={(e) => setBoundaries(e.target.value)}
                      placeholder="Ghét ai xúc phạm gia đình, không chịu nổi sự trễ hẹn..."
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: World Lorebook */}
              <div className="rounded-3xl border border-[#31333a] bg-[#212227] p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#2c2e35]">
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="h-5 w-5 text-zinc-300" />
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                        4. Bách Khoa Tri Thức
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Các mục tri thức địa danh, gia tộc, bảo bối được AI tra cứu tự động khi nhắc đến từ khóa
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#2b2c34] text-zinc-300 border border-[#3b3d46]">
                    {lorebookEntries.length} Mục
                  </span>
                </div>

                {/* Add new entry form */}
                <div className="p-4 rounded-2xl bg-[#18191c] border border-[#2b2c34] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Tiêu Đề Mục</label>
                      <input
                        type="text"
                        value={newLoreTitle}
                        onChange={(e) => setNewLoreTitle(e.target.value)}
                        placeholder="Quán Cà Phê Mèo May Mắn"
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Từ Khóa Kích Hoạt (Cách nhau dấu phẩy)</label>
                      <input
                        type="text"
                        value={newLoreKeywords}
                        onChange={(e) => setNewLoreKeywords(e.target.value)}
                        placeholder="quán cà phê, mèo may mắn, góc phố..."
                        className="w-full rounded-lg border border-[#31333c] bg-[#121316] px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Nội Dung Chi Tiết</label>
                    <textarea
                      rows={2}
                      value={newLoreContent}
                      onChange={(e) => setNewLoreContent(e.target.value)}
                      placeholder="Nằm ở cuối ngõ 45, nơi nhân vật thường ngồi vẽ tranh vào sáng chủ nhật..."
                      className="w-full rounded-lg border border-[#31333c] bg-[#121316] p-2.5 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLorebookEntry}
                    disabled={!newLoreTitle.trim() || !newLoreContent.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#2b2c34] hover:bg-[#353740] border border-[#3b3d46] text-xs font-semibold text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm Mục Tri Thức</span>
                  </button>
                </div>

                {/* Existing entries */}
                {lorebookEntries.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lorebookEntries.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#18191c] border border-[#2c2e35]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-100 truncate">{item.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#2b2c34] text-zinc-400 border border-[#3b3d46]">
                              {item.keywords.join(", ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{item.content}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLorebookEntry(idx)}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 5: Intimacy & Voice */}
              <div className="rounded-3xl border border-[#31333a] bg-[#212227] p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-[#2c2e35]">
                  <Heart className="h-5 w-5 text-zinc-300" />
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                    5. Quan Hệ Tình Cảm & Giọng Nói AI
                  </h3>
                </div>


                {/* Voice Profile */}
                <div className="p-4 rounded-2xl bg-[#18191c] border border-[#2b2d35] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <Volume2 className="h-4 w-4 text-zinc-400" />
                    Hồ Sơ Giọng Nói AI
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1.5">Giới Tính Giọng Đọc</label>
                      <div className="relative" ref={voiceDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                          className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#31333c] bg-[#121316] px-3.5 py-2 text-xs text-zinc-100 hover:border-zinc-400 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold">{voiceGender === "Male" ? "Giọng Nam" : "Giọng Nữ"}</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform ${isVoiceDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isVoiceDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-[#31333a] bg-[#1c1d22] p-1 shadow-2xl z-30 space-y-0.5 animate-in fade-in slide-in-from-top-1">
                            <button
                              type="button"
                              onClick={() => {
                                setVoiceGender("Female");
                                setIsVoiceDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                voiceGender === "Female"
                                  ? "bg-[#282930] text-white font-bold"
                                  : "hover:bg-[#25262c] text-zinc-300 hover:text-white"
                              }`}
                            >
                              <span>Giọng Nữ</span>
                              {voiceGender === "Female" && <Check className="h-3.5 w-3.5 text-zinc-200 shrink-0" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setVoiceGender("Male");
                                setIsVoiceDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                voiceGender === "Male"
                                  ? "bg-[#282930] text-white font-bold"
                                  : "hover:bg-[#25262c] text-zinc-300 hover:text-white"
                              }`}
                            >
                              <span>Giọng Nam</span>
                              {voiceGender === "Male" && <Check className="h-3.5 w-3.5 text-zinc-200 shrink-0" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Ngữ Điệu Giọng Nói</label>
                      <input
                        type="text"
                        value={voiceTone}
                        onChange={(e) => setVoiceTone(e.target.value)}
                        placeholder="Dịu dàng, ấm áp, có chút hờn dỗi nhẹ..."
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
            </div>

            {/* RIGHT COLUMN: Live Character Preview Card (Sticky) */}
            <div className="lg:col-span-3 sticky top-6 space-y-3">
              <div className="p-3 rounded-2xl bg-[#212227] border border-[#31333a] flex items-center justify-between shadow-sm">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-zinc-400" /> Xem Trước Thẻ Khám Phá
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#2b2c34] text-zinc-400 font-medium">
                  Trực Tiếp
                </span>
              </div>

              {/* Real-time Anime Poster Card Preview (2:3 Aspect Ratio) */}
              <div className="w-full max-w-[280px] mx-auto shadow-2xl">
                <CharacterCard
                  character={{
                    id: "preview-card",
                    name: name.trim() || "Tên Nhân Vật",
                    title: title.trim() || "Danh hiệu / Nghề nghiệp",
                    avatarUrl: avatarUrl || "",
                    personalityPrompt: personalityPrompt.trim() || "Chưa có tiểu sử... Hãy nhập thông tin hoặc bấm AI tự động phác thảo!",
                    greeting: "",
                    category: "",
                    tags: tagsInput ? tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : [],
                    isPublic,
                    worldGenre,
                    visualIdentity: {
                      fullBodyUrl: fullBodyUrl || undefined,
                      canonicalReferenceUrl: fullBodyUrl || undefined,
                    },
                    creatorName: "Bạn (Đang tạo)",
                    createdAt: new Date().toISOString(),
                  }}
                  onSelect={() => {}}
                  dense={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Dynamic Action Dock (Compact on Bottom Right) */}
      <div className="fixed bottom-5 right-5 sm:right-8 z-40 max-w-[95vw]">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#1c1d22]/90 backdrop-blur-md border border-[#31333c] shadow-[0_8px_25px_rgba(0,0,0,0.5)]">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 hover:text-white cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded accent-zinc-200 h-3.5 w-3.5 cursor-pointer"
            />
            <span className="font-medium hidden sm:inline">Công khai</span>
          </label>

          <div className="h-3.5 w-px bg-zinc-700/50" />

          <Link
            href="/studio"
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
          >
            Hủy
          </Link>

          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-950" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Khởi Tạo Nhân Vật</span>
              </>
            )}
          </button>
        </div>
      </div>

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
  );
}
