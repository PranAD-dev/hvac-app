require("dotenv").config();
const { execSync, spawn } = require("child_process");
const http = require("http");

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("\n  ERROR: Missing Cloudflare credentials.");
  console.error("  Copy .env.example to .env and fill in your values:\n");
  console.error("    cp .env.example .env\n");
  process.exit(1);
}

const CF_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/live_inputs`;

async function cfRequest(method, path = "", body = null) {
  const url = `${CF_API}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

async function main() {
  console.log("\n===========================================");
  console.log("  HVAC Glasses — Cloudflare Stream");
  console.log("  (Same infrastructure as MentraOS)");
  console.log("===========================================\n");

  // 1. Create a live input
  console.log("  [1/3] Creating Cloudflare Live Input...");
  const createRes = await cfRequest("POST", "", {
    meta: { name: "HVAC Glasses Camera" },
    recording: { mode: "automatic" },
  });

  if (!createRes.success) {
    console.error("  ERROR:", createRes.errors);
    process.exit(1);
  }

  const liveInput = createRes.result;
  const rtmpUrl = `${liveInput.rtmps.url}${liveInput.rtmps.streamKey}`;
  const rtmpPlain = liveInput.rtmps.url.replace("rtmps://", "rtmp://").replace(":443", ":1935");
  const hlsUrl = `https://customer-${ACCOUNT_ID}.cloudflarestream.com/${liveInput.uid}/manifest/video.m3u8`;
  const dashUrl = `https://customer-${ACCOUNT_ID}.cloudflarestream.com/${liveInput.uid}/manifest/video.mpd`;

  console.log("  [2/3] Live Input created!\n");

  console.log("===========================================");
  console.log("  RTMP Ingest (Cloudflare):");
  console.log(`    ${liveInput.rtmps.url}`);
  console.log(`    Key: ${liveInput.rtmps.streamKey}`);
  console.log("");
  console.log("  HLS Playback URL (paste in Expo app):");
  console.log(`    ${hlsUrl}`);
  console.log("");
  console.log("  DASH Playback URL:");
  console.log(`    ${dashUrl}`);
  console.log("===========================================\n");

  // Save the HLS URL to a file so the Expo app can read it
  const fs = require("fs");
  fs.writeFileSync("stream-urls.json", JSON.stringify({
    hlsUrl,
    dashUrl,
    rtmpUrl: liveInput.rtmps.url,
    streamKey: liveInput.rtmps.streamKey,
    liveInputId: liveInput.uid,
  }, null, 2));
  console.log("  Stream URLs saved to stream-urls.json\n");

  // 2. Start ffmpeg pushing to Cloudflare
  console.log("  [3/3] Starting camera → Cloudflare stream...\n");
  console.log("  (Allow camera access if prompted)\n");

  const ffmpeg = spawn("ffmpeg", [
    "-f", "avfoundation",
    "-framerate", "30",
    "-video_size", "1280x720",
    "-i", "0",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-b:v", "2000k",
    "-maxrate", "2000k",
    "-bufsize", "4000k",
    "-g", "60",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-f", "flv",
    rtmpUrl,
  ], { stdio: "inherit" });

  ffmpeg.on("close", async (code) => {
    console.log(`\n  ffmpeg exited (code ${code}). Cleaning up...`);

    // Delete the live input on exit
    console.log("  Deleting Cloudflare Live Input...");
    await cfRequest("DELETE", `/${liveInput.uid}`);
    console.log("  Done.\n");
    process.exit(0);
  });

  // Handle ctrl+c
  process.on("SIGINT", () => {
    console.log("\n  Stopping stream...");
    ffmpeg.kill("SIGINT");
  });

  // 3. Serve HLS URL for the Expo app to discover
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ hlsUrl, dashUrl }));
  });
  server.listen(8080, "0.0.0.0", () => {
    const os = require("os");
    const interfaces = os.networkInterfaces();
    let ip = "localhost";
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          ip = iface.address;
          break;
        }
      }
    }
    console.log(`  Discovery server running on http://${ip}:8080`);
    console.log(`  (Expo app can auto-discover the HLS URL)\n`);
  });
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
