import { NextRequest, NextResponse } from "next/server";

const COMFY_URL = "http://127.0.0.1:8188";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_KEY}`;

// Helper to upload image buffer to ComfyUI /upload/image
async function uploadImageToComfy(imageBuffer: Buffer, fileName: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
  formData.append("image", blob, fileName);
  formData.append("overwrite", "true");

  const res = await fetch(`${COMFY_URL}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload reference image to ComfyUI: HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.name || fileName;
}

// Helper to download image from URL or decode base64
async function resolveReferenceImageToComfy(referenceImageUrl: string): Promise<string> {
  const uniqueName = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;

  if (referenceImageUrl.startsWith("data:image/")) {
    const base64Data = referenceImageUrl.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    return await uploadImageToComfy(buffer, uniqueName);
  } else if (referenceImageUrl.startsWith("http://") || referenceImageUrl.startsWith("https://")) {
    const res = await fetch(referenceImageUrl);
    if (!res.ok) throw new Error(`Could not fetch reference image from URL: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return await uploadImageToComfy(Buffer.from(arrayBuffer), uniqueName);
  }

  return referenceImageUrl;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      characterName,
      characterTitle,
      characterPersonality,
      worldDescription,
      referenceImageUrl,
      visualIdentity,
      sceneState,
      messageContent,
      userMessageContent,
    } = body;

    // 1. Build prompt via Gemini
    const visualDna = visualIdentity
      ? `Permanent Anatomical DNA:
- Hair: ${visualIdentity.hair || "long flowing hair"}
- Eyes: ${visualIdentity.eyes || "expressive eyes"}
- Face: ${visualIdentity.face || "gentle refined features"}
- Body: ${visualIdentity.body || "slender graceful build"}
- Skin: ${visualIdentity.skin || "fair smooth skin"}
- Accessories: ${visualIdentity.accessories || "none"}
- Special Traits: ${visualIdentity.visualTraits || "none"}
- Aesthetic Style: ${visualIdentity.visualStyle || visualIdentity.style || "anime aesthetic, masterpiece, highly detailed"}`
      : "Permanent Anatomical DNA: anime aesthetic, masterpiece, highly detailed";

    const sceneDetails = sceneState
      ? `Dynamic Spatial State:
- Location: ${sceneState.currentLocation || "scenic environment"}
- Position: ${sceneState.currentPosition || "standing"}
- Active Outfit: ${sceneState.currentOutfit || "beautiful clothing"}
- Time & Lighting: ${sceneState.currentTimeOfDay || "golden hour rim lighting"}
- Held Items: ${sceneState.heldItems || "none"}
- Atmosphere: ${sceneState.atmosphere || "serene"}`
      : "Dynamic Spatial State: scenic environment, soft lighting";

    const geminiSystemPrompt = `You are a World-Class Scene Prompt Engineer for anime AI image generation.
Synthesize the character's physical identity, active outfit, and spatial environment into 35-50 comma-separated English Danbooru tags.
Strictly ensure:
1. Exact hair, eye, face traits from DNA are preserved.
2. The current active outfit is strictly depicted (do not default to standard clothing).
3. Pose, action, and camera framing match dialogue.
4. Beautiful scenery, masterpiece, best quality, highly detailed, 8k.
Output ONLY the raw comma-separated tags.`;

    const userPrompt = `Character: ${characterName || "Character"} (${characterTitle || "Heroine"})
Lore: ${characterPersonality || ""}
World: ${worldDescription || ""}
${visualDna}
${sceneDetails}
Moment:
- Player: "${userMessageContent || "Interacting together"}"
- Character: "${messageContent || "Standing gracefully"}"`;

    let cleanPrompt = "1girl, solo, masterpiece, best quality, highly detailed";
    try {
      const geminiRes = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${geminiSystemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 250 },
        }),
      });

      if (geminiRes.ok) {
        const geminiJson = await geminiRes.json();
        const candidate = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          cleanPrompt = candidate.replace(/\n+/g, ", ").trim();
        }
      }
    } catch (gErr) {
      console.warn("Gemini prompt generation failed, falling back:", gErr);
      cleanPrompt = `1girl, solo, ${characterName || "heroine"}, ${visualIdentity?.hair || "long hair"}, ${visualIdentity?.eyes || "expressive eyes"}, ${sceneState?.currentOutfit || "kimono"}, ${sceneState?.currentLocation || "kyoto tea garden"}, masterpiece, best quality, 8k`;
    }

    const enhancedPositive = `${cleanPrompt}, masterpiece, best quality, ultra-detailed, cinematic lighting, 8k`;
    const negativePrompt = "easynegative, bad-hands-5, (worst quality, low quality:1.4), (bad anatomy), (inaccurate limb:1.2), bad composition, deformed, extra arms, extra fingers, text, watermark, logo, cropped";

    // 2. Resolve Reference Image if provided
    let uploadedComfyImageName: string | null = null;
    if (referenceImageUrl && typeof referenceImageUrl === "string" && referenceImageUrl.trim()) {
      try {
        uploadedComfyImageName = await resolveReferenceImageToComfy(referenceImageUrl.trim());
      } catch (upErr) {
        console.warn("Could not upload reference image to ComfyUI, proceeding with text-to-image:", upErr);
      }
    }

    // 3. Build ComfyUI Workflow (Single-Slot Identity Conditioning or Text-To-Image)
    const seed = Math.floor(Math.random() * 1000000000);
    const width = 768;
    const height = 1024;
    let workflow: Record<string, any>;

    if (uploadedComfyImageName) {
      // Single-slot Identity conditioning workflow (IPAdapter)
      workflow = {
        "1": {
          class_type: "LoadImage",
          inputs: { image: uploadedComfyImageName },
        },
        "2": {
          class_type: "CLIPVisionLoader",
          inputs: { clip_name: "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors" },
        },
        "8": {
          class_type: "IPAdapterModelLoader",
          inputs: { ipadapter_file: "ip-adapter-plus_sd15.safetensors" },
        },
        "4": {
          class_type: "CheckpointLoaderSimple",
          inputs: { ckpt_name: "meinamix_meinaV11.safetensors" },
        },
        "10": {
          class_type: "IPAdapterAdvanced",
          inputs: {
            weight: 0.55,
            weight_type: "linear",
            combine_embeds: "concat",
            start_at: 0.0,
            end_at: 0.75,
            embeds_scaling: "K+V",
            model: ["4", 0],
            ipadapter: ["8", 0],
            image: ["1", 0],
            clip_vision: ["2", 0],
          },
        },
        "5": {
          class_type: "EmptyLatentImage",
          inputs: { width, height, batch_size: 1 },
        },
        "6": {
          class_type: "CLIPTextEncode",
          inputs: { text: enhancedPositive, clip: ["4", 1] },
        },
        "7": {
          class_type: "CLIPTextEncode",
          inputs: { text: negativePrompt, clip: ["4", 1] },
        },
        "3": {
          class_type: "KSampler",
          inputs: {
            seed,
            steps: 25,
            cfg: 7.0,
            sampler_name: "euler_ancestral",
            scheduler: "karras",
            denoise: 1.0,
            model: ["10", 0],
            positive: ["6", 0],
            negative: ["7", 0],
            latent_image: ["5", 0],
          },
        },
        "9": {
          class_type: "VAEDecode",
          inputs: { samples: ["3", 0], vae: ["4", 2] },
        },
        "11": {
          class_type: "SaveImage",
          inputs: { filename_prefix: "test_scene_render", images: ["9", 0] },
        },
      };
    } else {
      // Pure Text-to-Image workflow
      workflow = {
        "4": {
          class_type: "CheckpointLoaderSimple",
          inputs: { ckpt_name: "meinamix_meinaV11.safetensors" },
        },
        "5": {
          class_type: "EmptyLatentImage",
          inputs: { width, height, batch_size: 1 },
        },
        "6": {
          class_type: "CLIPTextEncode",
          inputs: { text: enhancedPositive, clip: ["4", 1] },
        },
        "7": {
          class_type: "CLIPTextEncode",
          inputs: { text: negativePrompt, clip: ["4", 1] },
        },
        "3": {
          class_type: "KSampler",
          inputs: {
            seed,
            steps: 25,
            cfg: 7.0,
            sampler_name: "euler_ancestral",
            scheduler: "karras",
            denoise: 1.0,
            model: ["4", 0],
            positive: ["6", 0],
            negative: ["7", 0],
            latent_image: ["5", 0],
          },
        },
        "9": {
          class_type: "VAEDecode",
          inputs: { samples: ["3", 0], vae: ["4", 2] },
        },
        "11": {
          class_type: "SaveImage",
          inputs: { filename_prefix: "test_scene_render", images: ["9", 0] },
        },
      };
    }

    // 4. Send to ComfyUI /prompt
    const queueRes = await fetch(`${COMFY_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueRes.ok) {
      const errText = await queueRes.text();
      throw new Error(`ComfyUI prompt queuing failed (${queueRes.status}): ${errText}`);
    }

    const queueData = await queueRes.json();
    const promptId = queueData.prompt_id;
    if (!promptId) {
      throw new Error("No prompt_id returned from ComfyUI.");
    }

    // 5. Poll for completion
    const startTime = Date.now();
    let generatedFilename = "";

    while (Date.now() - startTime < 120000) {
      await new Promise((r) => setTimeout(r, 1000));
      const histRes = await fetch(`${COMFY_URL}/history/${promptId}`);
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData[promptId]) {
          const entry = histData[promptId];
          if (entry.outputs && entry.outputs["11"] && entry.outputs["11"].images?.length > 0) {
            generatedFilename = entry.outputs["11"].images[0].filename;
            break;
          }
          if (entry.status && entry.status.status_str === "error") {
            throw new Error(`ComfyUI rendering failed: ${JSON.stringify(entry.status)}`);
          }
        }
      }
    }

    if (!generatedFilename) {
      throw new Error("Generation timed out after 120s.");
    }

    const imageUrl = `/api/test-scene/image?filename=${encodeURIComponent(generatedFilename)}`;

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
        prompt: cleanPrompt,
        filename: generatedFilename,
      },
    });
  } catch (err: any) {
    console.error("[TestScene API Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate scene image." },
      { status: 500 }
    );
  }
}
