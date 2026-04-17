/**
 * Generate job clips from an HVAC service video using Gemini 2.5 Pro.
 *
 * Usage:
 *   node scripts/generate-clips.js <video-path> [--job <jobId>] [--count <n>]
 *
 * Flow:
 *   1. Uploads the video to Gemini
 *   2. Asks for N short, interesting clip windows with captions
 *   3. Cuts each window with ffmpeg into assets/clips/
 *   4. Extracts a thumbnail frame for each clip into assets/clips/thumbs/
 *   5. Prints a Clip[] JSON array to stdout, ready to drop into seedData.ts
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { GoogleGenerativeAI } = require("@google/generative-ai");

require("dotenv").config({
  path: path.join(__dirname, "..", "server", ".env"),
});
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing from server/.env");

const args = process.argv.slice(2);
const VIDEO_PATH = args[0];
const jobFlagIdx = args.indexOf("--job");
const JOB_ID = jobFlagIdx >= 0 ? args[jobFlagIdx + 1] : "";
const countFlagIdx = args.indexOf("--count");
const CLIP_COUNT = countFlagIdx >= 0 ? parseInt(args[countFlagIdx + 1], 10) : 6;

if (!VIDEO_PATH) {
  console.error("Usage: node scripts/generate-clips.js <video-path> [--job <jobId>] [--count <n>]");
  process.exit(1);
}

const PROMPT = `You are analyzing a first-person video recorded during an HVAC service call (from smart glasses or a head-mounted camera).

Your job is to identify the most interesting SHORT CLIPS to save — moments a technician would actually want to reference later. Think:
- Close-ups of findings (oil stains, corrosion, burnt wiring, leaks)
- Reading a gauge or multimeter value
- Before/after shots of a repair
- Showing a nameplate or model number
- A key diagnostic moment

Rules:
- Return exactly ${CLIP_COUNT} clips (or fewer if the video is short).
- Each clip MUST be between 8 and 30 seconds long.
- Space clips throughout the video — don't cluster them.
- Caption is 1 sentence, 6-14 words, written in plain English describing what the clip shows. No "the technician" — just describe the content.
- Skip idle footage, walking, driving, and blank frames.

Respond with ONLY valid JSON in this exact format, no commentary, no markdown:
{
  "clips": [
    {
      "timestamp_start": 45,
      "timestamp_end": 62,
      "caption": "Close-up of oil staining at the Schrader valve indicating a slow leak"
    }
  ]
}`;

async function main() {
  const absVideo = path.resolve(VIDEO_PATH);
  if (!fs.existsSync(absVideo)) {
    console.error(`Video not found: ${absVideo}`);
    process.exit(1);
  }

  const videoSize = fs.statSync(absVideo).size;
  const videoDuration = Math.floor(
    parseFloat(
      execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${absVideo}"`
      )
        .toString()
        .trim()
    )
  );
  console.error(
    `Video: ${absVideo} (${(videoSize / 1024 / 1024).toFixed(1)} MB, ${videoDuration}s)`
  );

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  console.error("Reading and sending to Gemini 2.5 Pro...");
  const videoData = fs.readFileSync(absVideo).toString("base64");

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "video/mp4",
        data: videoData,
      },
    },
    { text: PROMPT },
  ]);

  const text = result.response.text();
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse Gemini response as JSON:");
    console.error(text);
    process.exit(1);
  }

  const rawClips = (parsed.clips || []).filter((c) => {
    const start = Math.floor(c.timestamp_start);
    const end = Math.floor(c.timestamp_end);
    if (end <= start || start < 0 || end > videoDuration) {
      console.error(
        `  SKIP out-of-range clip ${start}-${end}s (video is ${videoDuration}s): ${c.caption}`
      );
      return false;
    }
    return true;
  });
  if (rawClips.length === 0) {
    console.error("Gemini returned no clips.");
    process.exit(1);
  }

  const clipsDir = path.join(__dirname, "..", "assets", "clips");
  const thumbsDir = path.join(clipsDir, "thumbs");
  fs.mkdirSync(thumbsDir, { recursive: true });

  console.error(`\nCutting ${rawClips.length} clips with ffmpeg...`);

  const clipPrefix = JOB_ID || `clip-${Date.now().toString(36)}`;
  const recordedAt = new Date().toISOString();

  const finalClips = rawClips.map((c, i) => {
    const start = Math.max(0, Math.floor(c.timestamp_start));
    const end = Math.max(start + 1, Math.floor(c.timestamp_end));
    const duration = end - start;

    const baseName = `${clipPrefix}-${String(i + 1).padStart(2, "0")}`;
    const clipName = `${baseName}.mp4`;
    const thumbName = `${baseName}.jpg`;
    const clipPath = path.join(clipsDir, clipName);
    const thumbPath = path.join(thumbsDir, thumbName);

    try {
      // Stream copy when possible (fast), re-encode on failure
      try {
        execSync(
          `ffmpeg -y -ss ${start} -i "${absVideo}" -t ${duration} -c copy "${clipPath}" 2>/dev/null`
        );
      } catch {
        execSync(
          `ffmpeg -y -ss ${start} -i "${absVideo}" -t ${duration} -c:v libx264 -preset fast -c:a aac "${clipPath}" 2>/dev/null`
        );
      }
      execSync(
        `ffmpeg -y -ss ${Math.floor(start + duration / 2)} -i "${absVideo}" -frames:v 1 -q:v 3 -vf "scale=320:-1" "${thumbPath}" 2>/dev/null`
      );
      console.error(`  [${i + 1}] ${clipName} (${duration}s) — ${c.caption}`);
    } catch (err) {
      console.error(`  [${i + 1}] FAILED to cut clip: ${err.message}`);
    }

    return {
      id: `${baseName}`,
      file_path: `clips/${clipName}`,
      duration_seconds: duration,
      thumbnail_path: `clips/thumbs/${thumbName}`,
      caption: c.caption,
      recorded_at: recordedAt,
      recorded_by: "Mike Torres",
    };
  });

  const outJsonPath = path.join(clipsDir, `${clipPrefix}.json`);
  fs.writeFileSync(outJsonPath, JSON.stringify(finalClips, null, 2));
  console.error(`\nWrote metadata to ${outJsonPath}`);

  // Rewrite data/clipAssets.ts so every mp4 in assets/clips/ is bundled
  try {
    const allMp4s = fs
      .readdirSync(clipsDir)
      .filter((f) => f.endsWith(".mp4"))
      .sort();
    const allThumbs = fs.existsSync(thumbsDir)
      ? fs.readdirSync(thumbsDir).filter((f) => f.endsWith(".jpg")).sort()
      : [];
    const videoLines = allMp4s
      .map((f) => `  "${path.basename(f, ".mp4")}": require("../assets/clips/${f}"),`)
      .join("\n");
    const thumbLines = allThumbs
      .map((f) => `  "${path.basename(f, ".jpg")}": require("../assets/clips/thumbs/${f}"),`)
      .join("\n");
    const registry = `// Auto-generated by scripts/generate-clips.js — maps clip id → bundled asset.\n// Edit by re-running \`node scripts/generate-clips.js <video> --job <jobId>\`.\n\nexport const CLIP_VIDEOS: Record<string, number> = {\n${videoLines}\n};\n\nexport const CLIP_THUMBS: Record<string, number> = {\n${thumbLines}\n};\n`;
    const registryPath = path.join(__dirname, "..", "data", "clipAssets.ts");
    fs.writeFileSync(registryPath, registry);
    console.error(`Updated ${registryPath}`);
  } catch (err) {
    console.error("Failed to update clipAssets.ts:", err.message);
  }

  // Print final JSON to stdout
  console.log(JSON.stringify(finalClips, null, 2));
  console.error("\nDone. Drop the JSON above into seedData.ts for the target job,");
  console.error("or the clips/thumbs are already in assets/clips/.");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
