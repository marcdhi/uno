#!/bin/bash

echo "Testing fixed video processing..."

# Start the server in background
cargo run --release &
SERVER_PID=$!

# Wait for server to start
sleep 5

echo "Testing cinematic filter..."
curl -X POST http://localhost:3001/process \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://2ols7zxpax1fgssd.public.blob.vercel-storage.com/1748758276319-3150419-uhd_3840_2160_30fps.mp4",
    "operation": "applyFilter",
    "parameters": {
      "filter": "cinematic"
    }
  }' | jq '.'

# Kill the server
kill $SERVER_PID

echo "Test complete!" 