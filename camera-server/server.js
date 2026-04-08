const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const os = require("os");

const PORT = 8080;

// Get local IP for display
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

// HTTP server — serves the camera capture page
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

// WebSocket server — relays camera frames
const wss = new WebSocketServer({ server });

const mobileClients = new Set();
let browserSource = null;

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get("role");

  if (role === "camera") {
    // This is the laptop browser sending camera frames
    browserSource = ws;
    console.log("[camera] Browser camera source connected");

    ws.on("message", (data) => {
      // Relay frame to all mobile clients
      for (const client of mobileClients) {
        if (client.readyState === 1) {
          client.send(data);
        }
      }
    });

    ws.on("close", () => {
      console.log("[camera] Browser camera source disconnected");
      browserSource = null;
    });
  } else {
    // This is a mobile app client receiving frames
    mobileClients.add(ws);
    console.log(`[mobile] Client connected (${mobileClients.size} total)`);

    ws.on("close", () => {
      mobileClients.delete(ws);
      console.log(`[mobile] Client disconnected (${mobileClients.size} total)`);
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  console.log("");
  console.log("===========================================");
  console.log("  HVAC Glasses Camera Server");
  console.log("===========================================");
  console.log("");
  console.log(`  1. Open this in your laptop browser:`);
  console.log(`     http://localhost:${PORT}`);
  console.log("");
  console.log(`  2. In the Expo app Live tab, enter:`);
  console.log(`     ${ip}`);
  console.log("");
  console.log(`  (Both devices must be on the same WiFi)`);
  console.log("===========================================");
  console.log("");
});
