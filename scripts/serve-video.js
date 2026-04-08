/**
 * Serves a video file over HTTP with range request support (for seeking).
 * Usage: node scripts/serve-video.js [video-path] [port]
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const VIDEO_PATH =
  process.argv[2] ||
  "/Users/pranjaladhikari/Downloads/videoplayback.1775518523508.publer.com.mp4";
const PORT = parseInt(process.argv[3] || "9090", 10);

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const server = http.createServer((req, res) => {
  if (req.url !== "/video.mp4") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const stat = fs.statSync(VIDEO_PATH);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const file = fs.createReadStream(VIDEO_PATH, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
      "Access-Control-Allow-Origin": "*",
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(VIDEO_PATH).pipe(res);
  }
});

const ip = getLocalIP();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nVideo server running!\n`);
  console.log(`  Local:   http://localhost:${PORT}/video.mp4`);
  console.log(`  Network: http://${ip}:${PORT}/video.mp4`);
  console.log(`\nUse the Network URL in your app (phone must be on same WiFi)\n`);
});
