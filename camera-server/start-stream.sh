#!/bin/bash
# HVAC Glasses Camera Stream
# Same architecture as MentraOS: Camera → RTMP → Cloud → HLS → Phone
# (but running locally for prototype)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEDIAMTX_DIR="$SCRIPT_DIR/mediamtx"

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo ""
echo "==========================================="
echo "  HVAC Smart Glasses — Camera Stream"
echo "==========================================="
echo ""
echo "  Architecture (same as MentraOS):"
echo "  Laptop Camera → RTMP → Server → HLS → Phone"
echo ""

# Start mediamtx in background
echo "  [1/2] Starting media server..."
"$MEDIAMTX_DIR/mediamtx" "$MEDIAMTX_DIR/config.yml" &
MEDIAMTX_PID=$!
sleep 2

# Check if mediamtx started
if ! kill -0 $MEDIAMTX_PID 2>/dev/null; then
  echo "  ERROR: Media server failed to start"
  exit 1
fi

echo "  [2/2] Starting camera capture..."
echo ""

# List available cameras
echo "  Available cameras:"
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -E "^\[AVFoundation" | grep "video" | head -5
echo ""

echo "==========================================="
echo ""
echo "  Media server running on:"
echo "    RTMP ingest:  rtmp://localhost:1935/live/hvac"
echo "    HLS playback: http://$LOCAL_IP:8888/live/hvac/index.m3u8"
echo ""
echo "  In the Expo app Live tab, enter:"
echo "    $LOCAL_IP"
echo ""
echo "  (Both devices must be on same WiFi)"
echo "==========================================="
echo ""

# Start ffmpeg — capture camera 0 (usually FaceTime), push RTMP to mediamtx
# -f avfoundation -i "0"  = macOS camera device 0
# -c:v libx264            = H.264 encode (same as MentraOS glasses)
# -preset ultrafast        = low latency
# -tune zerolatency       = minimize delay
# -g 30                   = keyframe every 30 frames
# -f flv                  = RTMP container format
ffmpeg \
  -f avfoundation \
  -framerate 30 \
  -video_size 1280x720 \
  -i "0" \
  -c:v libx264 \
  -preset ultrafast \
  -tune zerolatency \
  -b:v 2000k \
  -maxrate 2000k \
  -bufsize 4000k \
  -g 30 \
  -f flv \
  "rtmp://localhost:1935/live/hvac"

# Cleanup
echo "Stopping media server..."
kill $MEDIAMTX_PID 2>/dev/null
echo "Done."
