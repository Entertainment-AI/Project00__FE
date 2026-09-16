"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Character,
  UpdateCharacterRequest,
  RelationshipMilestone,
  WorldGenre,
  CharacterBlueprint,
  CharacterVisualIdentity,
  CharacterVoiceProfile,
} from "@/types";
import { fetchCharacterById, updateCharacter, generateCharacterAvatar, generateCharacterStandee, resolveMediaUrl } from "@/lib/api";
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
  Check,
  Loader2,
  Upload,
  Globe,
  Image as ImageIcon,
  Brain,
  Volume2,
  Eye,
  UserCheck,
  Trash2,
  Crop,
  ChevronDown,
  Lock,
  Plus,
} from "lucide-react";
import Link from "next/link";

const GENDER_OPTIONS = [
  { id: "Female", label: "Nữ" },
  { id: "Male", label: "Nam" },
  { id: "Other", label: "Khác / Vô tính" },
];

export default function EditCharacterPage() {
  const params = useParams();
  const router = useRouter();
  const characterId = params.id as string;
  const { user, isAuthenticated, isLoading: isAuthLoading, openAuthModal } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      openAuthModal();
      router.push("/studio");
    }
  }, [isAuthLoading, isAuthenticated, router, openAuthModal]);

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [gender, setGender] = useState("Female");
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef<HTMLDivElement>(null);
  const [visualStyle, setVisualStyle] = useState("Anime");
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
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

  // Intimacy & Voice
  const [defaultAffectionScore, setDefaultAffectionScore] = useState<number>(0);
  const [defaultMood, setDefaultMood] = useState<string>("Bình thường");
  const [customMilestones, setCustomMilestones] = useState<RelationshipMilestone[]>([]);
  const [voiceGender, setVoiceGender] = useState("Female");
  const [voiceTone, setVoiceTone] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadChar = async () => {
      try {
        setIsLoading(true);
        const data = await fetchCharacterById(characterId);
        if (data) {
          setCharacter(data);

          setName(data.name || "");
          setTitle(data.title || "");
          setAvatarUrl(data.avatarUrl || "");
          setPersonalityPrompt(data.personalityPrompt || "");
          setTagsInput(data.tags?.join(", ") || "");
          setIsPublic(data.isPublic ?? true);
          setDefaultAffectionScore(data.defaultAffectionScore ?? 0);
          setDefaultMood(data.defaultMood || "Bình thường");
          setCustomMilestones(data.customMilestones || []);

          if (data.worldGenre !== undefined) {
            setWorldGenre(Number(data.worldGenre) as WorldGenre);
          }
          setWorldName(data.worldName || "");
          setWorldDescription(data.worldDescription || "");
          setCustomPhysicsRules(data.customPhysicsRules || "");

          if (data.blueprint) {
            setDesires(data.blueprint.psychology?.desires || "");
            setFears(data.blueprint.psychology?.fears || "");
            setWhenAngry(data.blueprint.behavior?.whenAngry || "");
            setWhenHappy(data.blueprint.behavior?.whenHappy || "");
            setAntiSycophancy(data.blueprint.rules?.antiSycophancy || "");
            setBoundaries(data.blueprint.rules?.boundaries?.join("; ") || "");
          }

          if (data.visualIdentity) {
            if (data.visualIdentity.style) setVisualStyle(data.visualIdentity.style);
            else if (data.visualIdentity.visualStyle) setVisualStyle(data.visualIdentity.visualStyle);
            if (data.visualIdentity.gender) setGender(data.visualIdentity.gender);
            else if (data.voiceProfile?.gender) setGender(data.voiceProfile.gender);
            setHair(data.visualIdentity.hair || "");
            setEyes(data.visualIdentity.eyes || "");
            setFace(data.visualIdentity.face || "");
            setAgeAppearance(data.visualIdentity.ageAppearance || "");
            setSkin(data.visualIdentity.skin || "");
            setBody(data.visualIdentity.body || "");
            setClothingStyle(data.visualIdentity.clothingStyle || "");
            setAccessories(data.visualIdentity.accessories || "");
            setVisualTraits(data.visualIdentity.visualTraits || "");
            if (data.visualIdentity.fullBodyUrl) {
              setFullBodyUrl(data.visualIdentity.fullBodyUrl);
            } else if (data.visualIdentity.canonicalReferenceUrl) {
              setFullBodyUrl(data.visualIdentity.canonicalReferenceUrl);
            }
          }

          if (data.voiceProfile) {
            setVoiceGender(data.voiceProfile.gender || "Female");
            setVoiceTone(data.voiceProfile.tone || "");
          }
        }
      } catch (err) {
        console.error("Failed to load character:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (characterId) {
      loadChar();
    }
  }, [characterId]);

  const canGenerateAvatar = Boolean(
    (name.trim() || character?.name) &&
    (title.trim() || character?.title) &&
    (personalityPrompt.trim() || character?.personalityPrompt)
  );

  const handleGenerateAvatarAi = async () => {
    if (isGeneratingAvatar || isGeneratingStandee) return;
    const targetName = (name.trim() || character?.name || "").trim();
    const targetTitle = (title.trim() || character?.title || "").trim();
    const targetBio = (personalityPrompt.trim() || character?.personalityPrompt || "").trim();

    if (!targetName || !targetTitle || !targetBio) {
      setError("Vui lòng điền đầy đủ Tên Nhân Vật, Danh Hiệu và Tiểu Sử để AI có đủ dữ kiện vẽ ảnh chân dung chính xác!");
      return;
    }

    const normalizedStyle = normalizeVisualStyle(visualStyle);
    const targetVisualIdentity = {
      gender,
      style: normalizedStyle,
      visualStyle: normalizedStyle,
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

    let newlyGeneratedAvatarUrl: string | null = null;
    try {
      setIsGeneratingAvatar(true);
      setError(null);
      const res = await generateCharacterAvatar({
        name: targetName,
        title: targetTitle,
        personalityPrompt: targetBio,
        worldGenre,
        visualIdentity: targetVisualIdentity,
      });

      if (res?.avatarUrl) {
        newlyGeneratedAvatarUrl = res.avatarUrl;
        setAvatarUrl(res.avatarUrl);
        setRawAvatarImage(res.avatarUrl);
      }
    } catch {
      setError("Không thể vẽ ảnh chân dung tự động. Vui lòng thử lại!");
      return;
    } finally {
      setIsGeneratingAvatar(false);
    }

    // Auto-chain standee generation so standee is always synchronized with the newly generated avatar
    if (newlyGeneratedAvatarUrl) {
      try {
        setIsGeneratingStandee(true);
        const standeeRes = await generateCharacterStandee({
          name: targetName,
          title: targetTitle,
          personalityPrompt: targetBio,
          worldGenre,
          visualIdentity: targetVisualIdentity,
          avatarUrl: newlyGeneratedAvatarUrl,
          referenceImageUrl: newlyGeneratedAvatarUrl,
        });

        if (standeeRes?.standeeUrl) {
          setFullBodyUrl(standeeRes.standeeUrl);
          setRawFullBodyImage(standeeRes.standeeUrl);
        }
      } catch (standeeErr) {
        console.warn("Auto-generate standee failed after avatar generation in edit page:", standeeErr);
        setError("Đã vẽ ảnh chân dung thành công nhưng chưa thể tạo dáng đứng. Bạn có thể bấm vẽ lại dáng đứng!");
      } finally {
        setIsGeneratingStandee(false);
      }
    }
  };

  const handleGenerateStandeeAi = async () => {
    if (isGeneratingStandee || isGeneratingAvatar) return;
    const targetName = (name.trim() || character?.name || "").trim();
    const targetTitle = (title.trim() || character?.title || "").trim();
    const targetBio = (personalityPrompt.trim() || character?.personalityPrompt || "").trim();

    if (!targetName || !targetTitle || !targetBio) {
      setError("Vui lòng điền đầy đủ Tên Nhân Vật, Danh Hiệu và Tiểu Sử để AI có đủ dữ kiện vẽ ảnh dáng đứng chính xác!");
      return;
    }

    const normalizedStyle = normalizeVisualStyle(visualStyle);
    try {
      setIsGeneratingStandee(true);
      setError(null);
      const res = await generateCharacterStandee({
        name: targetName,
        title: targetTitle,
        personalityPrompt: targetBio,
        worldGenre,
        visualIdentity: {
          gender,
          style: normalizedStyle,
          visualStyle: normalizedStyle,
          hair,
          eyes,
          face,
          ageAppearance,
          skin,
          body,
          clothingStyle,
          accessories,
          visualTraits,
        },
        avatarUrl: avatarUrl || character?.avatarUrl || undefined,
        referenceImageUrl: avatarUrl || character?.avatarUrl || undefined,
      });

      if (res?.standeeUrl) {
        setFullBodyUrl(res.standeeUrl);
        setRawFullBodyImage(res.standeeUrl);
      }
    } catch {
      setError("Không thể vẽ ảnh dáng đứng tự động. Vui lòng thử lại!");
    } finally {
      setIsGeneratingStandee(false);
    }
  };

  const handleGenerateBothImagesAi = async () => {
    await handleGenerateAvatarAi();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

      const req: UpdateCharacterRequest = {
        name: name.trim(),
        title: title.trim(),
        category: "",
        avatarUrl: avatarUrl.trim() || character.avatarUrl,
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
      };

      await updateCharacter(character.id, req);
      router.push("/studio");
    } catch (err: any) {
      console.error("Failed to update character:", err);
      setError(err.message || "Cập nhật nhân vật thất bại. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-[#18191c] text-zinc-100">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="h-full flex flex-col bg-[#18191c] text-zinc-100">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold text-zinc-200">Không tìm thấy nhân vật</h2>
          <Link href="/studio" className="mt-4 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-950 font-bold text-xs">
            Quay lại Studio
          </Link>
        </div>
      </div>
    );
  }

  const selectedGenre = getWorldGenreMeta(worldGenre);
  const selectedGender = GENDER_OPTIONS.find((g) => g.id === gender) || GENDER_OPTIONS[0];
  const selectedStyle = VISUAL_STYLE_OPTIONS.find((s) => s.id === visualStyle) || VISUAL_STYLE_OPTIONS[0];

  return (
    <div className="h-full flex flex-col bg-[#18191c] text-zinc-100 overflow-hidden selection:bg-[#353740] selection:text-white">
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
                Chỉnh Sửa Nhân Vật: {character.name}
              </h1>
              <p className="text-xs text-zinc-400">
                Tinh chỉnh 7 đặc tính, thế giới quan và bản thiết kế tâm lý
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

                        <div className="flex items-center gap-1.5 mt-3">
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

                        <div className="flex items-center gap-1.5 mt-3">
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
                    <div className="w-full mt-4">
                      <button
                        type="button"
                        onClick={() => handleGenerateBothImagesAi()}
                        disabled={isGeneratingAvatar || isGeneratingStandee || !canGenerateAvatar}
                        title={
                          !canGenerateAvatar
                            ? "Vui lòng điền Tên, Danh hiệu và Tiểu sử trước khi vẽ ảnh"
                            : "AI phân tích mô tả và vẽ cả 2 ảnh: Chân dung & Dáng đứng đồng bộ"
                        }
                        className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2b2c34] border border-[#3b3d46] text-zinc-200 hover:bg-[#353740] disabled:opacity-35 disabled:hover:bg-[#2b2c34] disabled:cursor-not-allowed text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-sm"
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
                        className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                      />
                    </div>

                    {/* Row 4: Tiểu Sử & Cuộc Sống Thường Nhật */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-zinc-300">
                          Tiểu Sử & Cuộc Sống Thường Nhật <span className="text-zinc-400">*</span>
                        </label>
                      </div>
                      <textarea
                        value={personalityPrompt}
                        onChange={(e) => setPersonalityPrompt(e.target.value)}
                        rows={6}
                        className="w-full min-h-[140px] rounded-xl border border-[#31333c] bg-[#16171b] p-3.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed resize-y"
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
                        placeholder="Cao 1m65, mảnh mai cân đối..."
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
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Quy Tắc Vật Lý / Sức Mạnh</label>
                    <input
                      type="text"
                      value={customPhysicsRules}
                      onChange={(e) => setCustomPhysicsRules(e.target.value)}
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
                    className="w-full rounded-2xl border border-[#31333c] bg-[#16171b] p-3.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none leading-relaxed"
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
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Nỗi Sợ Sâu Nhất</label>
                    <input
                      type="text"
                      value={fears}
                      onChange={(e) => setFears(e.target.value)}
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
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Phản Ứng Khi Vui Vẻ</label>
                    <input
                      type="text"
                      value={whenHappy}
                      onChange={(e) => setWhenHappy(e.target.value)}
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
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Ranh Giới Đỏ Cá Nhân</label>
                    <input
                      type="text"
                      value={boundaries}
                      onChange={(e) => setBoundaries(e.target.value)}
                      className="w-full rounded-xl border border-[#31333c] bg-[#16171b] px-3.5 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Intimacy & Voice */}
              <div className="rounded-3xl border border-[#31333a] bg-[#212227] p-6 sm:p-7 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-[#2c2e35]">
                  <Heart className="h-5 w-5 text-zinc-300" />
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                    4. Quan Hệ Tình Cảm & Giọng Nói AI
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
                    id: character.id || "preview-card",
                    name: name.trim() || character.name || "Tên Nhân Vật",
                    title: title.trim() || character.title || "Danh hiệu / Nghề nghiệp",
                    avatarUrl: avatarUrl || character.avatarUrl || "",
                    personalityPrompt: personalityPrompt.trim() || character.personalityPrompt || "Chưa có tiểu sử...",
                    greeting: "",
                    category: "",
                    tags: tagsInput ? tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : (character.tags || []),
                    isPublic,
                    worldGenre,
                    visualIdentity: {
                      fullBodyUrl: fullBodyUrl || character.visualIdentity?.fullBodyUrl || undefined,
                      canonicalReferenceUrl: fullBodyUrl || character.visualIdentity?.canonicalReferenceUrl || undefined,
                    },
                    creatorName: character.creatorName || "Bạn",
                    createdAt: character.createdAt || new Date().toISOString(),
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
                <span>Lưu Thay Đổi</span>
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
