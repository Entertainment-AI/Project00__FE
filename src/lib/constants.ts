import { WorldGenre } from "@/types";

export interface WorldGenreOption {
  id: WorldGenre;
  label: string;
  emoji: string;
  desc: string;
}

export const WORLD_GENRE_OPTIONS: WorldGenreOption[] = [
  { id: WorldGenre.MundaneSliceOfLife, label: "Hiện Đại & Đời Thường", emoji: "🏫", desc: "Học đường, công sở, tình cảm đô thị (vật lý thực tế, không phép thuật)" },
  { id: WorldGenre.HighFantasy, label: "Kỳ Ảo & Tiên Hiệp", emoji: "🐉", desc: "Ma pháp, tu tiên, chuyển sinh dị giới, kiếm hiệp" },
  { id: WorldGenre.UrbanSupernatural, label: "Đô Thị Dị Năng", emoji: "⚡", desc: "Thành phố hiện đại ẩn giấu siêu năng lực, ma cà rồng" },
  { id: WorldGenre.CyberpunkSciFi, label: "Khoa Học Viễn Tưởng", emoji: "🤖", desc: "Cyberpunk, AI, du hành vũ trụ, hậu tận thế" },
  { id: WorldGenre.Historical, label: "Cổ Trang & Lịch Sử", emoji: "🏯", desc: "Triều đình, giang hồ, bối cảnh cổ đại chân thực" },
  { id: WorldGenre.Custom, label: "Thế Giới Tự Do", emoji: "🔮", desc: "Quy tắc vật lý và bối cảnh hoàn toàn riêng biệt" },
];

export function getWorldGenreMeta(genre?: WorldGenre | number) {
  if (genre === undefined || genre === null) {
    return WORLD_GENRE_OPTIONS[0];
  }
  const numeric = Number(genre);
  return WORLD_GENRE_OPTIONS.find((g) => g.id === numeric) || WORLD_GENRE_OPTIONS[0];
}

export interface VisualStyleOption {
  id: string;
  label: string;
  model: string;
  desc: string;
}

export const VISUAL_STYLE_OPTIONS: VisualStyleOption[] = [
  { id: "Anime", label: "Hoạt Họa", model: "MeiNaMix", desc: "Phong cách nghệ thuật anime 2D, manga & tranh vẽ sống động" },
  { id: "Realistic", label: "Chân Thực", model: "majicMIX Realistic", desc: "Phong cách người thật chân thực, ánh sáng tự nhiên & đậm chất điện ảnh" },
];

export function normalizeVisualStyle(raw?: string | number): string {
  if (!raw && raw !== 0) return "Realistic";
  const str = String(raw).trim().toLowerCase();

  if (str === "anime" || str === "1" || str === "hoạt họa") {
    return "Anime";
  }

  return "Realistic";
}
