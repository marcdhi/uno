# Video Editing System Documentation

## Overview

This system provides AI-powered video editing capabilities through natural language commands. Users can upload videos, images, or audio files and describe the edits they want to apply, and the AI will use FFmpeg tools to process the media.

## Features

### Video Editing Tools

1. **Trim Video** - Cut video to specific time ranges
2. **Adjust Speed** - Change playback speed (0.5x to 2.0x)
3. **Adjust Brightness** - Modify video brightness (-100 to +100)
4. **Add Text** - Overlay text at top, center, or bottom positions
5. **Crop Video** - Crop to specific dimensions
6. **Rotate Video** - Rotate by 90, 180, or 270 degrees
7. **Adjust Volume** - Change audio volume (0.0 to 2.0x)
8. **Apply Filters** - Apply grayscale, sepia, blur, or sharpen filters

### How to Use

1. **Upload Media**: Click on the video, image, or audio icons in the chat input
2. **Provide Instructions**: Type what you want to do with the media (e.g., "Trim the first 10 seconds and add a title 'My Video'")
3. **Choose Mode**: 
   - **Quick Edit**: AI automatically applies edits based on your description
   - **Full Editor**: Opens a timeline-based editor (for videos)
4. **Apply Changes**: Click the "Apply Changes" button

### Example Commands

```
"Trim the video from 5 seconds to 30 seconds"
"Make the video 2x faster"
"Add text 'Hello World' at the bottom for the first 10 seconds"
"Crop the video to 1920x1080 starting from position 100,50"
"Rotate the video 90 degrees clockwise"
"Increase brightness by 20"
"Apply a grayscale filter"
"Reduce volume to 50%"
```

## Technical Implementation

### Server-Side Processing

- Uses **FFmpeg** for video processing
- Processes videos server-side for better performance
- Uploads processed videos to **Vercel Blob** storage
- All operations are asynchronous and non-blocking

### AI Integration

- Uses **Gemini Pro** model for natural language understanding
- Converts user instructions to specific tool calls
- Provides helpful feedback and suggestions
- Handles complex multi-step editing workflows

### File Handling

- Supports video files (MP4, MOV, AVI, etc.)
- Supports image files (JPG, PNG, GIF, etc.)
- Supports audio files (MP3, WAV, AAC, etc.)
- Automatic file type detection
- Secure file upload and storage

## Development

### Dependencies

```bash
pnpm add ffmpeg-static @ffmpeg/util @vercel/blob
```

### Environment Variables

Make sure these are set in your `.env.local`:

```
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
GOOGLE_API_KEY=your_gemini_api_key
```

### File Structure

```
lib/
  video-processor.ts          # Core video processing logic
app/(chat)/api/
  chat/route.ts              # AI chat endpoint with video tools
  files/upload/route.ts      # File upload handler
  files/upload-processed/route.ts  # Processed file upload
components/custom/
  multimodal-input.tsx       # File upload and preview UI
  message.tsx               # Message display with media
```

### Adding New Tools

To add new video editing capabilities:

1. Add the method to `VideoProcessor` class in `lib/video-processor.ts`
2. Add the tool definition in `app/(chat)/api/chat/route.ts`
3. Update the system prompt to include the new capability

Example:

```typescript
// In video-processor.ts
async addWatermark(videoUrl: string, watermarkText: string): Promise<string> {
  // Implementation
}

// In chat/route.ts
addWatermark: {
  description: "Add a watermark to the video",
  parameters: z.object({
    videoUrl: z.string(),
    watermarkText: z.string(),
  }),
  execute: async ({ videoUrl, watermarkText }) => {
    // Tool implementation
  },
}
```

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Make sure `ffmpeg-static` is installed
2. **Upload failures**: Check Vercel Blob token configuration
3. **Processing timeouts**: Large files may take time to process
4. **Memory issues**: Very large videos may cause memory problems

### Performance Tips

- Use smaller video files for testing
- Consider implementing progress feedback for long operations
- Add file size limits in production
- Cache processed videos when possible

## Security Considerations

- Validate file types and sizes
- Sanitize text inputs for overlays
- Implement rate limiting
- Monitor processing resources
- Clean up temporary files

## Future Enhancements

- Progress tracking for long operations
- Batch processing multiple files
- Advanced filters and effects
- Video compression options
- Timeline-based editing interface
- Collaborative editing features 