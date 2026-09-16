"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { fetchCharacters, fetchMyCharacters, resolveMediaUrl } from "@/lib/api";
import { CharacterVisualIdentity, Character } from "@/types";
import {
  ArrowLeft,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  Copy,
  Check,
  Download,
  Maximize2,
  X,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Sliders,
  User,
  MapPin,
  Shirt,
  Smile,
  Compass,
} from "lucide-react";

// Presets for instant, rich test scenarios
const SCENARIO_PRESETS = [
  {
    name: "🍵 Trà Đạo Kyoto (Mưa rào & Kimono lụa)",
    location: "Vườn trà truyền thống Kyoto trong cơn mưa rào mùa hạ",
    position: "Ngồi quỳ seiza tao nhã trên chiếu tatami cạnh bàn trà gỗ thấp sát hiên ngắm mưa",
    timeOfDay: "Chiều mưa rào mờ sương, ánh đèn lồng giấy washi tỏa sáng vàng ấm áp",
    atmosphere: "Thư thái, tiếng mưa rả rích trên mái ngói, thoang thoảng hương trầm và trà xanh",
    outfit: "Kimono lụa màu hoa anh đào thêu chỉ vàng hoa mẫu đơn, thắt lưng obi gấm đỏ thẫm, tay áo buông nhẹ tao nhã",
    heldItems: "Chén trà matcha bằng gốm Raku màu đen bốc khói nghi ngút",
    action: "Hai tay nhẹ nhàng nâng chén trà nóng, khẽ nghiêng đầu mỉm cười dịu dàng nhìn thẳng vào người đối diện, lọn tóc mai buông lơi bên gò má",
    userAction: "Ngồi đối diện im lặng lắng nghe tiếng mưa rơi rả rích bên ngoài hiên",
    framing: "cowboy shot",
  },
  {
    name: "📚 Thư Viện Cấm Nửa Đêm (Váy nhung & Sách cổ)",
    location: "Thư viện ma thuật cổ đại hoàng gia, những giá sách gỗ chạm khắc cao kịch trần",
    position: "Đứng bên cạnh bàn đọc sách bằng đá thạch anh, tựa nhẹ vào chồng sách cổ bìa da",
    timeOfDay: "Nửa đêm trăng tròn, ánh trăng xanh bạc huyền ảo chiếu qua cửa sổ vòm kính màu",
    atmosphere: "Tĩnh lặng tuyệt đối, huyền bí, những hạt bụi ma pháp lơ lửng phát sáng lấp lánh",
    outfit: "Váy dạ hội nhung đen tuyền ôm sát xẻ tà đính viền đá quý tím đêm, găng tay ren đen quý phái qua khuỷu tay",
    heldItems: "Cuốn sách ma thuật bìa da cổ phong ấn kim loại phát ánh sáng xanh lam dịu nhẹ",
    action: "Một tay lật nhẹ trang sách cổ phát sáng, ngước đôi mắt long lanh nhìn về phía bạn với vẻ ngạc nhiên xen lẫn hứng khởi, khóe môi khẽ cong",
    userAction: "Vừa cầm theo ngọn nến bước đến gần dãy bàn đọc sách",
    framing: "cowboy shot",
  },
  {
    name: "🌃 Sân Thượng Cyberpunk (Áo khoác da & Đèn Neon)",
    location: "Sân thượng tầng 88 tòa nhà chọc trời nhìn xuống khu phố Neo-City rực sáng",
    position: "Ngồi trên lan can kính cường lực an toàn, hai chân đung đưa thư thái nhìn xuống biển đèn neon",
    timeOfDay: "Đêm muộn mưa phùn lất phất, phản chiếu ánh sáng neon hồng tím và xanh ngọc",
    atmosphere: "Tự do, hiện đại, tiếng gió đêm vi vút hòa cùng tiếng động cơ bay xa xa",
    outfit: "Áo khoác da đen kiểu biker đính viền dạ quang xanh lục, áo croptop đen, quần short jean rách và bốt cao cổ",
    heldItems: "Lon nước soda phát sáng vị dưa hấu điện tử",
    action: "Một tay cầm lon soda mát lạnh, một tay vén tóc bay trong gió đêm, nháy mắt tinh nghịch cười toe toét nhìn bạn",
    userAction: "Đứng cạnh bên đưa cho cô ấy chiếc khăn choàng chắn gió",
    framing: "full body",
  },
  {
    name: "🏖️ Bờ Biển Hoàng Hôn (Váy Maxi Mùa Hè)",
    location: "Bờ biển cát trắng nhiệt đới hoang sơ, sóng biển dập dềnh êm dịu",
    position: "Đi dạo chân trần trên mép nước biển, nơi bọt sóng trắng vừa rút đi",
    timeOfDay: "Hoàng hôn rực rỡ sắc cam hồng tím (Golden hour), mặt trời đỏ rực chìm dần xuống biển",
    atmosphere: "Lãng mạn, thanh bình, gió biển thổi mát rượi lay động tà váy",
    outfit: "Váy maxi trắng hai dây vải voan bồng bềnh tung bay theo gió biển, đội mũ cói vành rộng thắt ruy băng xanh",
    heldItems: "Đôi dép sandal cói cầm trên tay",
    action: "Xoay người bước lùi lại nhìn bạn, hai tay giữ nhẹ vành mũ cói, nụ cười rạng rỡ tỏa sáng dưới ánh nắng chiều vàng",
    userAction: "Bước chậm rãi theo sau chụp lại khoảnh khắc tuyệt đẹp này",
    framing: "full body",
  },
  {
    name: "⚔️ Doanh Trại Chiến Tuyến (Chiến Giáp & Kiếm Phong Ấn)",
    location: "Doanh trại lều bạt dã chiến trên đỉnh đồi tuyết phủ nhìn xuống thung lũng",
    position: "Đứng cạnh bàn bản đồ tác chiến bằng gỗ thô, một tay chống lên chuôi kiếm cắm bên cạnh",
    timeOfDay: "Bình minh lạnh giá, ánh sáng ban mai xé toạc màn sương mù và tuyết trắng",
    atmosphere: "Hào hùng, kiên định, hơi thở hóa thành làn khói trắng trong không khí buốt giá",
    outfit: "Chiến giáp hiệp sĩ bằng bạc chạm khắc tinh xảo kết hợp áo choàng dạ màu xanh hải quân lót lông thú",
    heldItems: "Thanh trường kiếm phong ấn với cán bọc da màu đỏ thẫm",
    action: "Ánh mắt sắc bén nghiêm nghị nhìn về đường chân trời, sau đó quay lại khẽ gật đầu chào bạn với sự tôn trọng tuyệt đối",
    userAction: "Bước vào lều mang theo báo cáo tình hình chiến sự",
    framing: "cowboy shot",
  },
];

interface GeneratedHistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: string;
  renderTimeSec: number;
  characterName: string;
  outfit: string;
  location: string;
}

export default function TestScenePlaygroundPage() {
  // Characters
  const [dbCharacters, setDbCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("custom");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(true);

  // Character Core Info (Starts clean and blank)
  const [characterName, setCharacterName] = useState<string>("");
  const [characterTitle, setCharacterTitle] = useState<string>("");
  const [characterPersonality, setCharacterPersonality] = useState<string>("");
  const [worldDescription, setWorldDescription] = useState<string>("");
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>("");

  // Visual Identity DNA (Starts clean and blank)
  const [gender, setGender] = useState<string>("Female");
  const [hair, setHair] = useState<string>("");
  const [eyes, setEyes] = useState<string>("");
  const [face, setFace] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [skin, setSkin] = useState<string>("");
  const [accessories, setAccessories] = useState<string>("");
  const [visualTraits, setVisualTraits] = useState<string>("");
  const [visualStyle, setVisualStyle] = useState<string>("");
  const [isDnaExpanded, setIsDnaExpanded] = useState<boolean>(false);

  // Scene State (Spatial & Environmental - Starts clean)
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [currentPosition, setCurrentPosition] = useState<string>("");
  const [currentTimeOfDay, setCurrentTimeOfDay] = useState<string>("");
  const [atmosphere, setAtmosphere] = useState<string>("");

  // Active Outfit & Props (Starts clean)
  const [currentOutfit, setCurrentOutfit] = useState<string>("");
  const [heldItems, setHeldItems] = useState<string>("");

  // Pose, Action & Framing (Starts clean)
  const [messageContent, setMessageContent] = useState<string>("");
  const [userMessageContent, setUserMessageContent] = useState<string>("");
  const [framing, setFraming] = useState<string>("cowboy shot");

  // UI Execution State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationPhase, setGenerationPhase] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultPrompt, setResultPrompt] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState<boolean>(false);
  const [history, setHistory] = useState<GeneratedHistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset all character fields to empty
  const resetCharacterFields = () => {
    setCharacterName("");
    setCharacterTitle("");
    setCharacterPersonality("");
    setWorldDescription("");
    setReferenceImageUrl("");
    setGender("Female");
    setHair("");
    setEyes("");
    setFace("");
    setBody("");
    setSkin("");
    setAccessories("");
    setVisualTraits("");
    setVisualStyle("");
  };

  // Fetch real characters from database on mount
  useEffect(() => {
    async function loadCharacters() {
      try {
        const [publicChars, myChars] = await Promise.all([
          fetchCharacters().catch(() => []),
          fetchMyCharacters().catch(() => []),
        ]);
        const map = new Map<string, Character>();
        (publicChars || []).forEach((c) => map.set(c.id, c));
        (myChars || []).forEach((c) => map.set(c.id, c));
        const combined = Array.from(map.values());

        setDbCharacters(combined);

        if (combined.length > 0) {
          handleSelectCharacter(combined[0].id, combined);
        } else {
          handleSelectCharacter("custom", []);
        }
      } catch (err) {
        console.warn("Could not fetch DB characters:", err);
        handleSelectCharacter("custom", []);
      }
    }
    loadCharacters();
  }, []);

  // Timer for generating stopwatch
  useEffect(() => {
    if (isGenerating) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGenerating]);

  // Handle character selection from database
  const handleSelectCharacter = (charId: string, charsList = dbCharacters) => {
    setSelectedCharacterId(charId);
    if (charId === "custom") {
      setIsCustomMode(true);
      resetCharacterFields();
      return;
    }
    setIsCustomMode(false);

    const char = charsList.find((c) => c.id === charId);
    if (char) {
      setCharacterName(char.name || "");
      setCharacterTitle(char.title || "");
      setCharacterPersonality(char.personalityPrompt || "");
      setWorldDescription(char.worldDescription || "");
      setReferenceImageUrl(char.avatarUrl || "");

      const v = char.visualIdentity;
      if (v) {
        setGender(v.gender || "Female");
        setHair(v.hair || "");
        setEyes(v.eyes || "");
        setFace(v.face || "");
        setBody(v.body || "");
        setSkin(v.skin || "");
        setAccessories(v.accessories || "");
        setVisualTraits(v.visualTraits || "");
        const visual = v as CharacterVisualIdentity;
        setVisualStyle(visual.style || visual.visualStyle || "");
      } else {
        setGender("Female");
        setHair("");
        setEyes("");
        setFace("");
        setBody("");
        setSkin("");
        setAccessories("");
        setVisualTraits("");
        setVisualStyle("");
      }
    }
  };

  // Handle scenario preset load
  const handleLoadScenarioPreset = (presetIndex: number) => {
    const p = SCENARIO_PRESETS[presetIndex];
    if (!p) return;
    setCurrentLocation(p.location);
    setCurrentPosition(p.position);
    setCurrentTimeOfDay(p.timeOfDay);
    setAtmosphere(p.atmosphere);
    setCurrentOutfit(p.outfit);
    setHeldItems(p.heldItems);
    setMessageContent(p.action);
    setUserMessageContent(p.userAction);
    setFraming(p.framing);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setReferenceImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Trigger Scene Generation
  const handleGenerate = async () => {
    if (!messageContent.trim()) {
      setError("Vui lòng nhập hành động / tư thế nhân vật (messageContent).");
      return;
    }
    setError(null);
    setIsGenerating(true);
    setGenerationPhase("Gemini: Phân tích Identity DNA & bối cảnh để tạo prompt...");

    try {
      const fullActionWithFraming = `${messageContent.trim()}, ${framing}`;

      // Progress animation hints
      const t1 = setTimeout(() => {
        setGenerationPhase("ComfyUI: Nạp Identity Reference & dựng hình qua KSampler...");
      }, 3000);
      const t2 = setTimeout(() => {
        setGenerationPhase("ComfyUI: Tinh chỉnh chi tiết, ánh sáng & khử nhiễu (Denoising)...");
      }, 7000);
      const t3 = setTimeout(() => {
        setGenerationPhase("Hệ thống: Đang kết xuất và tải hình ảnh hoàn chỉnh...");
      }, 12000);

      const payload = {
        characterName: characterName.trim() || undefined,
        characterTitle: characterTitle.trim() || undefined,
        characterPersonality: characterPersonality.trim() || undefined,
        worldDescription: worldDescription.trim() || undefined,
        referenceImageUrl: referenceImageUrl.trim() || undefined,
        visualIdentity: {
          gender,
          hair,
          eyes,
          face,
          body,
          skin,
          accessories,
          visualTraits,
          style: visualStyle,
          visualStyle,
        },
        sceneState: {
          currentLocation: currentLocation.trim() || undefined,
          currentPosition: currentPosition.trim() || undefined,
          currentOutfit: currentOutfit.trim() || undefined,
          currentTimeOfDay: currentTimeOfDay.trim() || undefined,
          heldItems: heldItems.trim() || undefined,
          atmosphere: atmosphere.trim() || undefined,
        },
        messageContent: fullActionWithFraming,
        userMessageContent: userMessageContent.trim() || undefined,
      };

      const apiRes = await fetch("/api/test-scene/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!apiRes.ok) {
        const errJson = await apiRes.json().catch(() => null);
        throw new Error(errJson?.error || "Không thể tạo khung cảnh qua ComfyUI.");
      }

      const resJson = await apiRes.json();
      if (!resJson.success || !resJson.data?.imageUrl) {
        throw new Error(resJson.error || "Không nhận được hình ảnh từ ComfyUI.");
      }

      const resp = {
        imageUrl: resJson.data.imageUrl,
        prompt: resJson.data.prompt || "",
      };

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      setResultImage(resp.imageUrl);
      setResultPrompt(resp.prompt);

      // Save to test history
      const newHistoryItem: GeneratedHistoryItem = {
        id: Date.now().toString(),
        imageUrl: resp.imageUrl,
        prompt: resp.prompt,
        timestamp: new Date().toLocaleTimeString("vi-VN"),
        renderTimeSec: elapsedSeconds,
        characterName: characterName || "Nhân vật",
        outfit: currentOutfit || "Mặc định",
        location: currentLocation || "Bối cảnh",
      };
      setHistory((prev) => [newHistoryItem, ...prev]);
    } catch (err: any) {
      console.error("Scene generation error:", err);
      setError(err.message || "Đã xảy ra lỗi khi tạo ảnh khung cảnh. Vui lòng kiểm tra backend và ComfyUI!");
    } finally {
      setIsGenerating(false);
      setGenerationPhase("");
    }
  };

  const copyPromptToClipboard = () => {
    if (!resultPrompt) return;
    navigator.clipboard.writeText(resultPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Chaining: Use generated image as next reference image
  const useAsNextReference = () => {
    if (!resultImage) return;
    setReferenceImageUrl(resultImage);
    alert("Đã đặt ảnh cảnh vừa tạo làm Reference Image cho lượt tiếp theo!");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#121316] text-zinc-100">
      <Header />

      {/* Top Banner & Quick Presets */}
      <div className="flex-shrink-0 border-b border-[#24252d] bg-[#181920]/80 backdrop-blur-md px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="p-1.5 rounded-lg bg-[#252630] hover:bg-[#2e303d] text-zinc-400 hover:text-white transition-colors"
            title="Quay về"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 font-semibold uppercase tracking-wider">
                Visual Fidelity Sandbox
              </span>
              <span className="text-xs text-zinc-500 hidden sm:inline">|</span>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                ComfyUI Ready
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 mt-0.5">
              Phòng Thí Nghiệm Khung Cảnh & Trang Phục Nhân Vật
            </h1>
          </div>
        </div>

        {/* Quick Scenario Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-zinc-400 whitespace-nowrap flex items-center gap-1">
            <Wand2 className="h-3 w-3 text-purple-400" /> Kịch bản mẫu:
          </span>
          {SCENARIO_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleLoadScenarioPreset(idx)}
              className="text-xs px-2.5 py-1 rounded-lg bg-[#22242d] hover:bg-[#2c2f3c] border border-[#303340] text-zinc-300 hover:text-white transition-all whitespace-nowrap cursor-pointer hover:border-purple-500/40"
            >
              {p.name.split(" ")[0]} {p.name.split(" ")[1]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Left Form (Scrollable) | Right Preview (Fixed/Sticky) */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT COLUMN: Comprehensive Input Form */}
        <div className="lg:col-span-7 xl:col-span-7 h-full overflow-y-auto px-5 py-6 space-y-6 border-r border-[#24252d]">
          {/* SECTION 1: Character & Identity DNA */}
          <div className="p-5 rounded-2xl bg-[#181920] border border-[#272935] shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#272935]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">1. Nhân Vật & Mỏ Neo Diện Mạo (Identity Anchor)</h2>
                  <p className="text-xs text-zinc-400">Chọn nhân vật có sẵn hoặc nhập thủ công đặc điểm nhân trắc học</p>
                </div>
              </div>

              {/* Character Selector Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={isCustomMode ? "custom" : selectedCharacterId}
                  onChange={(e) => handleSelectCharacter(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#22242e] border border-[#343746] text-zinc-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {dbCharacters.length > 0 ? (
                    <optgroup label="Nhân vật trong Database">
                      {dbCharacters.map((c) => (
                        <option key={c.id} value={c.id}>
                          👤 {c.name} {c.title ? `- ${c.title}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option disabled value="">
                      (Chưa có nhân vật trong Database)
                    </option>
                  )}
                  <option value="custom">✏️ Tự nhập nhân vật mới...</option>
                </select>
              </div>
            </div>

            {/* Character Base Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Tên Nhân Vật *</label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Nhập tên nhân vật..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Danh Hiệu / Thân Phận</label>
                <input
                  type="text"
                  value={characterTitle}
                  onChange={(e) => setCharacterTitle(e.target.value)}
                  placeholder="Nhập danh hiệu hoặc vai trò..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Tính Cách & Khí Chất</label>
                <input
                  type="text"
                  value={characterPersonality}
                  onChange={(e) => setCharacterPersonality(e.target.value)}
                  placeholder="Mô tả thần thái, nét mặt, phong thái đặc trưng..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Thế Giới / Bối Cảnh Gốc (World)</label>
                <input
                  type="text"
                  value={worldDescription}
                  onChange={(e) => setWorldDescription(e.target.value)}
                  placeholder="Mô tả thế giới bối cảnh để AI tạo phong cách môi trường tương thích..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Reference Image Anchor Input */}
            <div className="p-4 rounded-xl bg-[#1d1f27] border border-[#2d303e] flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#262833] border border-[#3b3e4f] flex-shrink-0 shadow-inner group">
                {referenceImageUrl ? (
                  <img
                    src={resolveMediaUrl(referenceImageUrl)}
                    alt="Reference Anchor"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
                    <ImageIcon className="h-6 w-6 mb-1" />
                    <span className="text-[9px]">Trống</span>
                  </div>
                )}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-purple-300 font-medium">
                  Anchor
                </div>
              </div>

              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">
                    Ảnh Tham Chiếu Diện Mạo (Reference Image URL / File) *
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 cursor-pointer font-medium"
                  >
                    <Upload className="h-3 w-3" /> Tải ảnh từ máy tính
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                <input
                  type="text"
                  value={referenceImageUrl.startsWith("data:") ? "[Ảnh tải từ máy tính Base64]" : referenceImageUrl}
                  onChange={(e) => setReferenceImageUrl(e.target.value)}
                  placeholder="https://... hoặc tải ảnh từ máy tính"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#242631] border border-[#323544] text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-zinc-400">
                  ⚡ ComfyUI sẽ nạp ảnh này vào Conditioning Slot để khóa khuôn mặt và diện mạo bất biến.
                </p>
              </div>
            </div>

            {/* Collapsible Anatomical DNA Fields */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsDnaExpanded(!isDnaExpanded)}
                className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-[#20222a] hover:bg-[#262833] text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-purple-400" />
                  Chi tiết DNA Nhân Trắc Học (Tóc, Mắt, Khuôn mặt, Vóc dáng)
                </span>
                {isDnaExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {isDnaExpanded && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#1d1f27] border border-[#2c2f3d]">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Kiểu tóc & Màu tóc</label>
                    <input
                      type="text"
                      value={hair}
                      onChange={(e) => setHair(e.target.value)}
                      placeholder="e.g. long wavy platinum blonde hair"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#242631] border border-[#343746] text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Màu mắt & Ánh mắt</label>
                    <input
                      type="text"
                      value={eyes}
                      onChange={(e) => setEyes(e.target.value)}
                      placeholder="e.g. emerald green eyes"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#242631] border border-[#343746] text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Khuôn mặt & Biểu cảm cơ bản</label>
                    <input
                      type="text"
                      value={face}
                      onChange={(e) => setFace(e.target.value)}
                      placeholder="e.g. gentle elegant features, soft smile"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#242631] border border-[#343746] text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Chiều cao & Vóc dáng</label>
                    <input
                      type="text"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="e.g. 1m65, slender graceful build"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#242631] border border-[#343746] text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Nước da</label>
                    <input
                      type="text"
                      value={skin}
                      onChange={(e) => setSkin(e.target.value)}
                      placeholder="e.g. fair porcelain skin"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#242631] border border-[#343746] text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Phụ kiện bất biến</label>
                    <input
                      type="text"
                      value={accessories}
                      onChange={(e) => setAccessories(e.target.value)}
                      placeholder="e.g. gold cross earrings"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#242631] border border-[#343746] text-xs text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Đặc điểm nhận dạng riêng (Visual Traits)</label>
                    <input
                      type="text"
                      value={visualTraits}
                      onChange={(e) => setVisualTraits(e.target.value)}
                      placeholder="e.g. mole under left eye, silver hair pin"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#242631] border border-[#343746] text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Spatial & Environmental State */}
          <div className="p-5 rounded-2xl bg-[#181920] border border-[#272935] shadow-lg space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#272935]">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">2. Bối Cảnh & Không Gian Vật Lý (Spatial State)</h2>
                <p className="text-xs text-zinc-400">Xác định địa điểm, vị trí đứng/ngồi, thời điểm và bầu không khí</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Địa điểm */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Địa Điểm Chính (Current Location) *
                </label>
                <input
                  type="text"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  placeholder="Ví dụ: Vườn trà Kyoto, Thư viện hoàng gia, Sân thượng Cyberpunk..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    "Vườn trà Kyoto mưa rào",
                    "Thư viện ma thuật cổ đại",
                    "Sân thượng Cyberpunk về đêm",
                    "Bãi biển hoàng hôn nhiệt đới",
                    "Đại sảnh cung điện đá cẩm thạch",
                    "Quán cà phê cổ điển Paris",
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentLocation(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[#252733] hover:bg-[#2d3040] text-zinc-400 hover:text-blue-300 border border-[#343748] transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vị trí trong không gian */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Vị Trí Cụ Thể Trong Không Gian (Current Position)
                </label>
                <input
                  type="text"
                  value={currentPosition}
                  onChange={(e) => setCurrentPosition(e.target.value)}
                  placeholder="Ví dụ: Ngồi cạnh bàn trà thấp, Tựa lưng vào ban công gỗ nhìn ra xa..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    "Ngồi quỳ seiza tao nhã trên chiếu tatami",
                    "Tựa lưng vào lan can kính ngắm thành phố",
                    "Ngồi trên ghế bành bọc nhung cạnh lò sưởi",
                    "Đứng bên bậu cửa sổ ngắm trăng",
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPosition(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[#252733] hover:bg-[#2d3040] text-zinc-400 hover:text-blue-300 border border-[#343748] transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thời điểm & Ánh sáng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Thời Điểm & Ánh Sáng (Time & Lighting)
                  </label>
                  <input
                    type="text"
                    value={currentTimeOfDay}
                    onChange={(e) => setCurrentTimeOfDay(e.target.value)}
                    placeholder="Ví dụ: Hoàng hôn vàng rực rỡ, Đêm trăng tròn..."
                    className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Bầu Không Khí & Thời Tiết (Atmosphere)
                  </label>
                  <input
                    type="text"
                    value={atmosphere}
                    onChange={(e) => setAtmosphere(e.target.value)}
                    placeholder="Ví dụ: Thư thái, tiếng mưa rả rích, hương trầm..."
                    className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Active Outfit & Props */}
          <div className="p-5 rounded-2xl bg-[#181920] border border-[#272935] shadow-lg space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#272935]">
              <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                <Shirt className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">3. Trang Phục & Đạo Cụ Đang Dùng (Active Outfit & Props)</h2>
                <p className="text-xs text-zinc-400">Kiểm thử đổi trang phục linh hoạt nhưng vẫn giữ nguyên diện mạo</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Trang phục hiện tại */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Mô Tả Trang Phục Cụ Thể Trong Cảnh Này (Current Active Outfit) *
                </label>
                <textarea
                  rows={2}
                  value={currentOutfit}
                  onChange={(e) => setCurrentOutfit(e.target.value)}
                  placeholder="Mô tả cặn kẽ kiểu dáng, chất liệu vải, màu sắc, hoa văn thêu..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-pink-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    "Kimono lụa hoa anh đào màu lam nhạt, obi đỏ thêu chỉ vàng",
                    "Váy dạ hội nhung đen xẻ tà đính kim cương, găng tay ren đen",
                    "Áo sơ mi trắng oversize mềm mại buông lơi, quần short jean",
                    "Bộ đồ ngủ lụa satin màu kem viền ren tinh xảo",
                    "Chiến giáp hiệp sĩ bạc chạm khắc hoa văn cổ, áo choàng lam",
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentOutfit(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[#252733] hover:bg-[#2d3040] text-zinc-400 hover:text-pink-300 border border-[#343748] transition-colors cursor-pointer"
                    >
                      + {preset.substring(0, 32)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Vật phẩm cầm trên tay */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Vật Phẩm / Đạo Cụ Cầm Trên Tay (Held Items)
                </label>
                <input
                  type="text"
                  value={heldItems}
                  onChange={(e) => setHeldItems(e.target.value)}
                  placeholder="Ví dụ: Chén trà matcha bốc khói, Cuốn sách ma thuật cổ, Chiếc ô trong suốt..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-pink-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    "Chén trà matcha bốc khói",
                    "Cuốn sách ma thuật bìa da cổ",
                    "Chiếc ô trong suốt đọng nước mưa",
                    "Ly rượu vang đỏ Bordeaux",
                    "Thanh katana trong bao gỗ đen",
                    "Không cầm gì (None)",
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setHeldItems(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[#252733] hover:bg-[#2d3040] text-zinc-400 hover:text-pink-300 border border-[#343748] transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Pose, Action & Framing */}
          <div className="p-5 rounded-2xl bg-[#181920] border border-[#272935] shadow-lg space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#272935]">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Smile className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">4. Hành Động, Tư Thế & Biểu Cảm (Pose & Action)</h2>
                <p className="text-xs text-zinc-400">Cử chỉ của nhân vật, khung hình chụp và bối cảnh người tương tác</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Hành động nhân vật */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Hành Động, Cử Chỉ & Biểu Cảm Của Nhân Vật (Character Action) *
                </label>
                <textarea
                  rows={3}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Mô tả chi tiết: Ngồi/đứng thế nào, tay làm gì, ánh mắt nhìn ai, nụ cười biểu cảm ra sao..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    "Ngồi quỳ seiza tao nhã, hai tay nâng chén trà nóng, mỉm cười dịu dàng nhìn thẳng vào bạn",
                    "Đứng tựa lan can ngắm sao, một tay vén lọn tóc mai bay trong gió đêm, mắt vương chút u buồn",
                    "Nghiêng đầu tinh nghịch, một ngón tay đặt lên môi, nháy mắt bí ẩn",
                    "Khẽ ngước nhìn lên khi thấy bạn bước vào, đôi mắt sáng lên niềm vui mừng",
                  ].map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMessageContent(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[#252733] hover:bg-[#2d3040] text-zinc-400 hover:text-amber-300 border border-[#343748] transition-colors cursor-pointer"
                    >
                      + {preset.substring(0, 36)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Khung hình & Góc máy */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Góc Khung Hình (Camera Framing)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "cowboy shot", label: "Cowboy Shot (Từ đùi lên - Khuyên dùng)" },
                    { id: "full body", label: "Full Body (Toàn thân chân thực)" },
                    { id: "upper body", label: "Upper Body (Từ thắt lưng lên)" },
                    { id: "close-up portrait", label: "Close-up (Cận cảnh khuôn mặt)" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFraming(f.id)}
                      className={`text-xs p-2 rounded-xl border text-center font-medium transition-all cursor-pointer ${
                        framing === f.id
                          ? "bg-purple-500/20 border-purple-500 text-purple-200"
                          : "bg-[#20222b] border-[#2e313f] text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hành động người chơi */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Bối Cảnh Tương Tác Của Bạn (User Action / Dialogue Context)
                </label>
                <input
                  type="text"
                  value={userMessageContent}
                  onChange={(e) => setUserMessageContent(e.target.value)}
                  placeholder="Ví dụ: Ngồi đối diện im lặng lắng nghe tiếng mưa rơi, Vừa bước vào phòng mang theo một cốc cà phê..."
                  className="w-full px-3 py-2 rounded-xl bg-[#20222b] border border-[#2e313f] text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Execution & Fidelity Comparison Panel */}
        <div className="lg:col-span-5 xl:col-span-5 h-full overflow-y-auto bg-[#15161c] px-5 py-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Primary Action Button */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/30 via-[#1e202b] to-pink-900/20 border border-purple-500/30 shadow-xl">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Đang Phác Họa Khung Cảnh ({elapsedSeconds}s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Tạo Khung Cảnh & Kiểm Tra Visual Continuity</span>
                  </>
                )}
              </button>

              {/* Dynamic Status / Phase */}
              {isGenerating && (
                <div className="mt-3 p-3 rounded-xl bg-black/40 border border-purple-500/20 flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping mt-1.5 flex-shrink-0"></div>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-purple-200">{generationPhase}</p>
                    <p className="text-[11px] text-zinc-400">
                      Pipeline: Gemini DNA Expansion → ComfyUI KSampler Identity Conditioning (~10-15s)
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-bold">Không thể tạo khung cảnh:</p>
                    <p className="text-[11px] mt-0.5">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Side-by-Side Comparison Container */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-purple-400" /> So Sánh Visual Continuity
                </h3>
                {resultImage && (
                  <button
                    type="button"
                    onClick={useAsNextReference}
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                    title="Đặt ảnh này làm mỏ neo tiếp theo để test Turn chaining"
                  >
                    🔁 Dùng làm Reference lượt tới
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 1. Original Identity Anchor */}
                <div className="flex flex-col rounded-xl overflow-hidden bg-[#1a1c24] border border-[#2b2d3a] shadow-md">
                  <div className="p-2 bg-[#1f212c] border-b border-[#2b2d3a] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-300">Ảnh Gốc (Anchor)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Face DNA
                    </span>
                  </div>
                  <div className="aspect-[3/4] relative bg-[#131418] flex items-center justify-center overflow-hidden">
                    {referenceImageUrl ? (
                      <img
                        src={resolveMediaUrl(referenceImageUrl)}
                        alt="Original Anchor"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-zinc-500">Chưa có ảnh</span>
                    )}
                  </div>
                </div>

                {/* 2. Generated Scene Image */}
                <div className="flex flex-col rounded-xl overflow-hidden bg-[#1a1c24] border border-[#2b2d3a] shadow-md">
                  <div className="p-2 bg-[#1f212c] border-b border-[#2b2d3a] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400">Ảnh Cảnh Tạo Ra</span>
                    {resultImage && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ComfyUI
                      </span>
                    )}
                  </div>
                  <div className="aspect-[3/4] relative bg-[#131418] flex items-center justify-center overflow-hidden group">
                    {resultImage ? (
                      <>
                        <img
                          src={resolveMediaUrl(resultImage)}
                          alt="Rendered Scene"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsFullscreenModalOpen(true)}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white cursor-pointer backdrop-blur-sm"
                            title="Xem kích thước đầy đủ"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>
                          <a
                            href={resolveMediaUrl(resultImage)}
                            download="scene-render.png"
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white cursor-pointer backdrop-blur-sm"
                            title="Tải ảnh về máy"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4 text-zinc-500 text-xs">
                        <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-40" />
                        <span>Chưa có ảnh tạo</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Tags Inspector */}
            {resultPrompt && (
              <div className="p-4 rounded-xl bg-[#1a1c24] border border-[#2b2d3a] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Gemini Prompt Tags Đã Sinh Ra
                  </span>
                  <button
                    type="button"
                    onClick={copyPromptToClipboard}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" /> Đã sao chép
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Sao chép
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-[#121318] border border-[#252733] max-h-36 overflow-y-auto">
                  <p className="text-[11px] text-zinc-300 font-mono leading-relaxed select-all">
                    {resultPrompt}
                  </p>
                </div>
              </div>
            )}

            {/* Test Run History Thumbnails */}
            {history.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#242631]">
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Lịch sử render trong phiên ({history.length})
                </span>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setResultImage(item.imageUrl);
                        setResultPrompt(item.prompt);
                      }}
                      className="w-16 h-20 rounded-lg overflow-hidden bg-[#20222b] border border-[#303342] flex-shrink-0 cursor-pointer hover:border-purple-500 transition-all relative group"
                    >
                      <img
                        src={resolveMediaUrl(item.imageUrl)}
                        alt="History item"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] text-white">
                        Xem lại
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-center pt-4 pb-2 border-t border-[#24252e] text-[11px] text-zinc-500">
            Frontend Visual Fidelity Benchmark • Project00 Character AI Engine
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isFullscreenModalOpen && resultImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsFullscreenModalOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsFullscreenModalOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={resolveMediaUrl(resultImage)}
            alt="Fullscreen View"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
