#!/bin/bash

echo "Processing video with cinematic filter..."

curl -X POST http://localhost:3001/process \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://2ols7zxpax1fgssd.public.blob.vercel-storage.com/1748758276319-3150419-uhd_3840_2160_30fps.mp4",
    "operation": "applyFilter",
    "parameters": {
      "filter": "cinematic"
    }
  }' | jq '.'

echo "Processing complete!" 