/**
 * Generate a Job Story from an HVAC service video using Gemini 2.5 Pro.
 *
 * Usage:
 *   node scripts/generate-story.js <video-path> [--key <api-key>]
 *
 * The script:
 *   1. Uploads the video to Gemini's File API
 *   2. Sends a structured prompt asking for timestamped story segments
 *   3. Outputs a JobStory JSON to stdout
 *   4. Also extracts thumbnail frames via ffmpeg for each segment
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  GoogleGenerativeAI,
  FileState,
} = require("@google/generative-ai");

require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });
const GEMINI_API_KEY =
  process.argv.find((a, i) => process.argv[i - 1] === "--key") ||
  process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing (set it in server/.env, export it, or pass --key)");

const VIDEO_PATH = process.argv[2];

if (!VIDEO_PATH) {
  console.error("Usage: node scripts/generate-story.js <video-path>");
  process.exit(1);
}

const STORY_PROMPT = `You are analyzing a first-person video recorded during an HVAC service call. The video was captured from smart glasses or a head-mounted camera.

Your job is to create a structured "Job Story" — a timeline of the key moments in this service call.

IMPORTANT: Write everything in SECOND PERSON ("you") — the reader IS the technician who recorded this video. Example: "You drove to the job site" not "The technician drove to the job site".

For each key moment, provide:
- timestamp_start: seconds from video start
- timestamp_end: seconds from video start
- title: short title (3-8 words)
- description: 1-3 sentences in second person ("you") describing what you did, what equipment/components are visible, and any findings
- tag: one of "travel", "inspection", "diagnostic", "repair", "customer", "complete"

Also provide an overall summary (2-3 sentences) of the entire service call, also in second person.

Rules:
- Write in second person ("you arrived", "you tested", "you found") — the reader is the technician
- Only include RELEVANT moments — skip idle time, walking between areas, or non-work footage
- Focus on moments that show: arriving at site, locating equipment, taking readings, inspecting components, making repairs, talking to customers
- Use HVAC-specific terminology (condenser, evaporator, superheat, subcooling, capacitor, contactor, refrigerant, etc.)
- Be specific about what tools and equipment you see (multimeter, clamp meter, leak detector, gauges, etc.)
- Identify brands/models if visible
- Aim for 5-10 segments total

Respond with ONLY valid JSON in this exact format:
{
  "summary": "...",
  "segments": [
    {
      "timestamp_start": 0,
      "timestamp_end": 90,
      "title": "...",
      "description": "...",
      "tag": "travel"
    }
  ]
}`;

async function main() {
  console.error("Starting Gemini video analysis...");
  console.error(`Video: ${VIDEO_PATH}`);

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // --- Step 1: Upload video via inline data or File API ---
  const videoSize = fs.statSync(VIDEO_PATH).size;
  console.error(`Video size: ${(videoSize / 1024 / 1024).toFixed(1)} MB`);

  // Use the Gemini File API for large files
  const fileManager = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  // Read file as base64 for inline upload (Gemini supports up to 2GB inline for video)
  console.error("Reading video file...");
  const videoData = fs.readFileSync(VIDEO_PATH);
  const base64Video = videoData.toString("base64");
  console.error("Video loaded into memory.");

  // --- Step 2: Send to Gemini ---
  console.error("Sending to Gemini 2.5 Pro...");

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "video/mp4",
        data: base64Video,
      },
    },
    { text: STORY_PROMPT },
  ]);

  const response = result.response;
  const text = response.text();

  // Extract JSON from response (may be wrapped in ```json blocks)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let storyData;
  try {
    storyData = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON:");
    console.error(text);
    process.exit(1);
  }

  // --- Step 3: Extract thumbnail frames ---
  const outDir = path.join(__dirname, "..", "assets", "story");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.error(`Extracting ${storyData.segments.length} thumbnails...`);

  storyData.segments.forEach((seg, i) => {
    const frameName = `frame_${String(i + 1).padStart(2, "0")}.jpg`;
    const framePath = path.join(outDir, frameName);
    const seekTime = Math.floor(
      seg.timestamp_start + (seg.timestamp_end - seg.timestamp_start) / 2
    );

    try {
      execSync(
        `ffmpeg -y -ss ${seekTime} -i "${VIDEO_PATH}" -frames:v 1 -q:v 2 "${framePath}" 2>/dev/null`
      );
      seg.thumbnail_path = `assets/story/${frameName}`;
      console.error(`  [${i + 1}] ${frameName} @ ${seekTime}s — ${seg.title}`);
    } catch {
      seg.thumbnail_path = "";
      console.error(`  [${i + 1}] FAILED to extract frame @ ${seekTime}s`);
    }
  });

  // --- Step 4: Build final JobStory ---
  const jobStory = {
    id: `story-${Date.now().toString(36)}`,
    job_id: "",
    video_path: VIDEO_PATH,
    summary: storyData.summary,
    segments: storyData.segments.map((seg, i) => ({
      id: `seg-${String(i + 1).padStart(2, "0")}`,
      ...seg,
    })),
    generated_at: new Date().toISOString(),
  };

  // Output JSON to stdout
  console.log(JSON.stringify(jobStory, null, 2));
  console.error("\nDone! Story JSON printed to stdout.");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
