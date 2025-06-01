import { convertToCoreMessages, Message, streamText } from "ai";
import { z } from "zod";

import { geminiProModel } from "@/ai";
import {
  generateReservationPrice,
  generateSampleFlightSearchResults,
  generateSampleFlightStatus,
  generateSampleSeatSelection,
} from "@/ai/actions";
import { auth } from "@/app/(auth)/auth";
import {
  createReservation,
  deleteChatById,
  getChatById,
  getReservationById,
  saveChat,
} from "@/db/queries";
import { generateUUID } from "@/lib/utils";
import { videoProcessor } from "@/lib/video-processor";
import { rustVideoClient } from "@/lib/rust-video-client";

export async function POST(request: Request) {
  const { id, messages }: { id: string; messages: Array<Message> } =
    await request.json();

  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Debug logging to see the message structure
  console.log("Received messages:", JSON.stringify(messages, null, 2));
  
  // Check for experimental_attachments before conversion
  const messagesWithAttachments = messages.filter(m => m.experimental_attachments && m.experimental_attachments.length > 0);
  console.log("Messages with attachments before conversion:", messagesWithAttachments.length);
  if (messagesWithAttachments.length > 0) {
    console.log("Attachment details:", messagesWithAttachments.map(m => ({
      role: m.role,
      content: m.content,
      attachments: m.experimental_attachments
    })));
  }
  
  const coreMessages = convertToCoreMessages(messages);
  console.log("Core messages after conversion:", JSON.stringify(coreMessages, null, 2));
  
  // Check if Rust server is available
  let useRustServer = false;
  try {
    const health = await rustVideoClient.healthCheck();
    useRustServer = health.status === 'healthy' && health.ffmpeg_available;
    console.log("Rust server status:", health);
  } catch (error) {
    console.log("Rust server not available, falling back to Node.js:", error);
  }
  
  // Don't use convertToCoreMessages - AI SDK now handles this automatically
  // This preserves experimental_attachments
  const result = await streamText({
    model: geminiProModel,
    system: `
        - You are Glam AI, a professional video editing assistant that helps users create amazing videos using natural language commands
        - You can handle simple edits, complex workflows, and style-based transformations
        - Keep your responses concise and focused on the editing task
        - After each tool call, briefly describe what was done
        - Ask for clarification if the user's request is ambiguous
        - Always provide immediate feedback about what you're doing to keep users informed
        
        CRITICAL WORKFLOW: When a user uploads a video and requests edits:
        1. FIRST call getVideoFromAttachments to extract the video URL from their message
        2. WAIT for the result and get the actual videoUrl from the response
        3. THEN use that EXACT videoUrl in subsequent tool calls (NOT placeholders like <video_url>)
        4. Always inform the user what you're doing during processing
        
        EXAMPLE CORRECT WORKFLOW:
        User: "Make this video cinematic"
        Step 1: Call getVideoFromAttachments() → returns { videoUrl: "https://actual-url.com/video.mp4" }
        Step 2: Call applyCinematicStyle({ videoUrl: "https://actual-url.com/video.mp4" }) ← Use the ACTUAL URL
        
        NEVER use placeholder values like "<video_url>" - always use the real URL from getVideoFromAttachments!
        
        STYLE-BASED EDITING: When users mention styles like:
        - "Make it cinematic" → use applyCinematicStyle with the REAL video URL
        - "Give it a vintage look" → use applyVintageStyle with the REAL video URL
        - "Make it social media ready" → use applyVideoStyle with "social-media" and the REAL video URL
        - "Professional appearance" → use applyVideoStyle with "professional" and the REAL video URL
        - "Modern and clean" → use applyVideoStyle with "modern" and the REAL video URL
        
        INTELLIGENT PARSING: Understand user intent from natural language:
        - "Make it faster" = adjust speed
        - "Brighten it up" = adjust brightness
        - "Add my logo" = add text/watermark
        - "Make it square" = crop to 1:1 aspect ratio
        - "Portrait mode" = crop to 9:16 aspect ratio
        - "Landscape" = crop to 16:9 aspect ratio
        
        Always be helpful, creative, and suggest improvements when appropriate.
        Provide clear feedback about processing status to keep users engaged.
        
        REMEMBER: NEVER use placeholder URLs - always use the actual URL from getVideoFromAttachments!
      `,
    messages: coreMessages,
    tools: {
      getVideoFromAttachments: {
        description: "Extract the video URL from the user's message attachments. Use this first when the user has uploaded a video and wants to edit it.",
        parameters: z.object({}),
        execute: async ({}) => {
          try {
            console.log("Looking for video attachments...");
            console.log("Total messages:", messages.length);
            
            // Look for the most recent user message with video attachments
            const userMessages = messages.filter(m => m.role === 'user');
            console.log("User messages:", userMessages.length);
            
            for (let i = userMessages.length - 1; i >= 0; i--) {
              const message = userMessages[i];
              console.log(`Checking message ${i}:`, {
                content: message.content,
                hasAttachments: !!message.experimental_attachments,
                attachments: message.experimental_attachments
              });
              
              if (message.experimental_attachments && message.experimental_attachments.length > 0) {
                const videoAttachment = message.experimental_attachments.find(
                  att => att.contentType?.startsWith('video/')
                );
                
                if (videoAttachment) {
                  console.log("Found video attachment:", videoAttachment);
                  return {
                    success: true,
                    videoUrl: videoAttachment.url,
                    videoName: videoAttachment.name || 'Uploaded video',
                    message: `Found video: ${videoAttachment.name || 'Uploaded video'}`
                  };
                }
              }
            }
            
            console.log("No video attachments found");
            return {
              success: false,
              error: "No video found in recent messages. Please upload a video first using the video upload button."
            };
          } catch (error) {
            console.error("Failed to get video from attachments:", error);
            return {
              success: false,
              error: "Failed to extract video URL"
            };
          }
        },
      },
      applyCinematicStyle: {
        description: "Apply a cinematic style to the video with professional color grading and enhanced visuals",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video to apply cinematic style to"),
        }),
        execute: async ({ videoUrl }) => {
          try {
            if (useRustServer) {
              console.log("Using Rust server for cinematic style processing");
              const result = await rustVideoClient.applyCinematicStyle(videoUrl);
              
              if (result.success && result.video_url) {
                // Download the processed video from Rust server
                console.log("Downloading processed video from Rust server:", result.video_url);
                const videoResponse = await fetch(result.video_url);
                
                if (!videoResponse.ok) {
                  throw new Error(`Failed to download processed video: ${videoResponse.statusText}`);
                }
                
                const videoBuffer = await videoResponse.arrayBuffer();
                
                // Upload to Vercel Blob for permanent storage
                console.log("Uploading processed video to Vercel Blob...");
                const timestamp = Date.now();
                const filename = `cinematic_${timestamp}.mp4`;
                
                const { put } = await import('@vercel/blob');
                const blob = await put(filename, videoBuffer, {
                  access: 'public',
                  contentType: 'video/mp4',
                  token: process.env.BLOB_READ_WRITE_TOKEN,
                });
                
                console.log("Successfully uploaded to Vercel Blob:", blob.url);
                
                return {
                  success: true,
                  editedVideoUrl: blob.url,
                  processingTimeMs: result.processing_time_ms,
                  message: `Applied cinematic style in ${result.processing_time_ms}ms using high-performance processing. Video saved permanently.`
                };
              } else {
                throw new Error(result.error || "Rust server processing failed");
              }
            } else {
              // Fallback to Node.js processing
              console.log("Using Node.js fallback for cinematic style");
              const editedUrl = await videoProcessor.applyStyle(videoUrl, "cinematic");
              return {
                success: true,
                editedVideoUrl: editedUrl,
                message: "Applied cinematic style with professional color grading"
              };
            }
          } catch (error) {
            console.error("Failed to apply cinematic style:", error);
            return {
              success: false,
              error: "Failed to apply cinematic style to video",
            };
          }
        },
      },
      applyVintageStyle: {
        description: "Apply a vintage/retro style to the video with warm tones and film grain",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video to apply vintage style to"),
        }),
        execute: async ({ videoUrl }) => {
          try {
            if (useRustServer) {
              console.log("Using Rust server for vintage style processing");
              const result = await rustVideoClient.applyVintageStyle(videoUrl);
              
              if (result.success && result.video_url) {
                // Download the processed video from Rust server
                console.log("Downloading processed video from Rust server:", result.video_url);
                const videoResponse = await fetch(result.video_url);
                
                if (!videoResponse.ok) {
                  throw new Error(`Failed to download processed video: ${videoResponse.statusText}`);
                }
                
                const videoBuffer = await videoResponse.arrayBuffer();
                
                // Upload to Vercel Blob for permanent storage
                console.log("Uploading processed video to Vercel Blob...");
                const timestamp = Date.now();
                const filename = `vintage_${timestamp}.mp4`;
                
                const { put } = await import('@vercel/blob');
                const blob = await put(filename, videoBuffer, {
                  access: 'public',
                  contentType: 'video/mp4',
                  token: process.env.BLOB_READ_WRITE_TOKEN,
                });
                
                console.log("Successfully uploaded to Vercel Blob:", blob.url);
                
                return {
                  success: true,
                  editedVideoUrl: blob.url,
                  processingTimeMs: result.processing_time_ms,
                  message: `Applied vintage style in ${result.processing_time_ms}ms using high-performance processing. Video saved permanently.`
                };
              } else {
                throw new Error(result.error || "Rust server processing failed");
              }
            } else {
              // Fallback to Node.js processing
              console.log("Using Node.js fallback for vintage style");
              const editedUrl = await videoProcessor.applyStyle(videoUrl, "vintage");
              return {
                success: true,
                editedVideoUrl: editedUrl,
                message: "Applied vintage style with warm tones and retro feel"
              };
            }
          } catch (error) {
            console.error("Failed to apply vintage style:", error);
            return {
              success: false,
              error: "Failed to apply vintage style to video",
            };
          }
        },
      },
      fastBrightness: {
        description: "Quickly adjust video brightness using high-performance processing",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          brightness: z.number().describe("Brightness adjustment (-100 to 100)"),
        }),
        execute: async ({ videoUrl, brightness }) => {
          try {
            if (useRustServer) {
              console.log("Using Rust server for brightness adjustment");
              const result = await rustVideoClient.adjustBrightness(videoUrl, brightness);
              
              if (result.success && result.video_url) {
                return {
                  success: true,
                  editedVideoUrl: result.video_url,
                  processingTimeMs: result.processing_time_ms,
                  message: `Adjusted brightness in ${result.processing_time_ms}ms using high-performance processing`
                };
              } else {
                throw new Error(result.error || "Rust server processing failed");
              }
            } else {
              // Fallback to Node.js processing
              console.log("Using Node.js fallback for brightness adjustment");
              const editedUrl = await videoProcessor.adjustBrightness(videoUrl, brightness);
              return {
                success: true,
                editedVideoUrl: editedUrl,
                message: `Adjusted video brightness by ${brightness > 0 ? '+' : ''}${brightness}%`
              };
            }
          } catch (error) {
            console.error("Failed to adjust brightness:", error);
            return {
              success: false,
              error: "Failed to adjust video brightness",
            };
          }
        },
      },
      analyzeVideo: {
        description: "Analyze video properties like duration, resolution, fps, and audio presence",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video to analyze"),
        }),
        execute: async ({ videoUrl }) => {
          try {
            const analysis = await videoProcessor.analyzeVideo(videoUrl);
            return {
              success: true,
              analysis,
              message: `Video analysis: ${analysis.duration}s duration, ${analysis.resolution.width}x${analysis.resolution.height} resolution, ${analysis.fps} fps, ${analysis.hasAudio ? 'has audio' : 'no audio'}`
            };
          } catch (error) {
            console.error("Failed to analyze video:", error);
            return {
              success: false,
              error: "Failed to analyze video properties",
            };
          }
        },
      },
      batchEditVideo: {
        description: "Apply multiple editing operations to a video in sequence. Use this for complex editing requests that involve multiple steps.",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video to edit"),
          operations: z.array(z.object({
            type: z.string().describe("Type of operation (trimVideo, adjustSpeed, adjustBrightness, addText, cropVideo, rotateVideo, adjustVolume, applyFilter, cropToAspectRatio, enhanceColors, stabilizeVideo, normalizeAudio)"),
            parameters: z.record(z.any()).describe("Parameters for the operation"),
            order: z.number().describe("Order of execution (1, 2, 3, etc.)")
          })).describe("Array of operations to perform in order"),
        }),
        execute: async ({ videoUrl, operations }) => {
          try {
            if (useRustServer) {
              console.log("Using Rust server for batch processing");
              const result = await rustVideoClient.processBatch({
                video_url: videoUrl,
                operations: operations.map(op => ({
                  type: op.type,
                  parameters: op.parameters,
                  order: op.order
                }))
              });
              
              if (result.success && result.video_url) {
                // Download the processed video from Rust server
                console.log("Downloading processed video from Rust server:", result.video_url);
                const videoResponse = await fetch(result.video_url);
                
                if (!videoResponse.ok) {
                  throw new Error(`Failed to download processed video: ${videoResponse.statusText}`);
                }
                
                const videoBuffer = await videoResponse.arrayBuffer();
                
                // Upload to Vercel Blob for permanent storage
                console.log("Uploading processed video to Vercel Blob...");
                const timestamp = Date.now();
                const filename = `batch_edited_${timestamp}.mp4`;
                
                const { put } = await import('@vercel/blob');
                const blob = await put(filename, videoBuffer, {
                  access: 'public',
                  contentType: 'video/mp4',
                  token: process.env.BLOB_READ_WRITE_TOKEN,
                });
                
                console.log("Successfully uploaded to Vercel Blob:", blob.url);
                
                return {
                  success: true,
                  editedVideoUrl: blob.url,
                  operationsApplied: operations.length,
                  processingTimeMs: result.processing_time_ms,
                  message: `Applied ${operations.length} operations in ${result.processing_time_ms}ms using high-performance processing. Video saved permanently.`
                };
              } else {
                throw new Error(result.error || "Rust server processing failed");
              }
            } else {
              // Fallback to Node.js processing
              console.log("Using Node.js fallback for batch processing");
              const editedUrl = await videoProcessor.batchEdit({
                videoUrl,
                operations
              });
              return {
                success: true,
                editedVideoUrl: editedUrl,
                operationsApplied: operations.length,
                message: `Successfully applied ${operations.length} editing operations to the video`
              };
            }
          } catch (error) {
            console.error("Failed to batch edit video:", error);
            return {
              success: false,
              error: "Failed to apply batch edits to video",
            };
          }
        },
      },
      applyVideoStyle: {
        description: "Apply a predefined style preset to the video. Available styles: cinematic, vintage, modern, social-media, professional",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          style: z.enum(["cinematic", "vintage", "modern", "social-media", "professional"]).describe("Style preset to apply"),
        }),
        execute: async ({ videoUrl, style }) => {
          try {
            const editedUrl = await videoProcessor.applyStyle(videoUrl, style);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              appliedStyle: style,
              message: `Applied ${style} style to the video`
            };
          } catch (error) {
            console.error("Failed to apply style:", error);
            return {
              success: false,
              error: `Failed to apply ${style} style`,
            };
          }
        },
      },
      getAvailableStyles: {
        description: "Get list of available video styles that can be applied",
        parameters: z.object({}),
        execute: async ({}) => {
          try {
            const styles = videoProcessor.getAvailableStyles();
            return {
              success: true,
              styles,
              message: `Available styles: ${styles.map(s => s.name).join(', ')}`
            };
          } catch (error) {
            console.error("Failed to get styles:", error);
            return {
              success: false,
              error: "Failed to get available styles",
            };
          }
        },
      },
      createVideoMontage: {
        description: "Create a montage from multiple video clips with transitions",
        parameters: z.object({
          videoUrls: z.array(z.string()).describe("Array of video URLs to combine"),
          transitions: z.array(z.string()).optional().describe("Array of transition types (fade, crossfade, etc.)"),
          musicUrl: z.string().optional().describe("Optional background music URL"),
        }),
        execute: async ({ videoUrls, transitions, musicUrl }) => {
          try {
            const editedUrl = await videoProcessor.createMontage(videoUrls, transitions, musicUrl);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              clipsUsed: videoUrls.length,
              message: `Created montage from ${videoUrls.length} video clips`
            };
          } catch (error) {
            console.error("Failed to create montage:", error);
            return {
              success: false,
              error: "Failed to create video montage",
            };
          }
        },
      },
      addMultipleTexts: {
        description: "Add multiple text overlays to a video with different timing and positions",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          textOverlays: z.array(z.object({
            text: z.string().describe("Text to display"),
            position: z.enum(["top", "center", "bottom"]).describe("Position of the text"),
            startTime: z.number().describe("Start time in seconds"),
            endTime: z.number().describe("End time in seconds"),
            style: z.string().optional().describe("Text style (large, red, etc.)")
          })).describe("Array of text overlays with timing"),
        }),
        execute: async ({ videoUrl, textOverlays }) => {
          try {
            const editedUrl = await videoProcessor.addMultipleTexts(videoUrl, textOverlays);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              textsAdded: textOverlays.length,
              message: `Added ${textOverlays.length} text overlays to the video`
            };
          } catch (error) {
            console.error("Failed to add multiple texts:", error);
            return {
              success: false,
              error: "Failed to add multiple text overlays",
            };
          }
        },
      },
      cropToAspectRatio: {
        description: "Crop video to a specific aspect ratio (16:9, 9:16, 1:1, 4:3)",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          ratio: z.enum(["16:9", "9:16", "1:1", "4:3"]).describe("Aspect ratio to crop to"),
        }),
        execute: async ({ videoUrl, ratio }) => {
          try {
            const editedUrl = await videoProcessor.cropToAspectRatio(videoUrl, ratio);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              aspectRatio: ratio,
              message: `Cropped video to ${ratio} aspect ratio`
            };
          } catch (error) {
            console.error("Failed to crop to aspect ratio:", error);
            return {
              success: false,
              error: "Failed to crop video to aspect ratio",
            };
          }
        },
      },
      enhanceColors: {
        description: "Enhance video colors with improved saturation and contrast",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          saturation: z.number().optional().describe("Saturation multiplier (default: 1.2)"),
        }),
        execute: async ({ videoUrl, saturation = 1.2 }) => {
          try {
            const editedUrl = await videoProcessor.enhanceColors(videoUrl, saturation);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              saturationApplied: saturation,
              message: `Enhanced video colors with ${Math.round(saturation * 100)}% saturation`
            };
          } catch (error) {
            console.error("Failed to enhance colors:", error);
            return {
              success: false,
              error: "Failed to enhance video colors",
            };
          }
        },
      },
      stabilizeVideo: {
        description: "Stabilize shaky video footage",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video to stabilize"),
        }),
        execute: async ({ videoUrl }) => {
          try {
            const editedUrl = await videoProcessor.stabilizeVideo(videoUrl);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              message: "Video stabilization applied successfully"
            };
          } catch (error) {
            console.error("Failed to stabilize video:", error);
            return {
              success: false,
              error: "Failed to stabilize video",
            };
          }
        },
      },
      normalizeAudio: {
        description: "Normalize audio levels for consistent volume",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
        }),
        execute: async ({ videoUrl }) => {
          try {
            const editedUrl = await videoProcessor.normalizeAudio(videoUrl);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              message: "Audio levels normalized successfully"
            };
          } catch (error) {
            console.error("Failed to normalize audio:", error);
            return {
              success: false,
              error: "Failed to normalize audio",
            };
          }
        },
      },
      trimVideo: {
        description: "Trim a video to specified start and end times",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video to trim"),
          startTime: z.number().describe("Start time in seconds"),
          endTime: z.number().describe("End time in seconds"),
        }),
        execute: async ({ videoUrl, startTime, endTime }) => {
          try {
            const editedUrl = await videoProcessor.trimVideo(videoUrl, startTime, endTime);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              duration: endTime - startTime,
              message: `Video trimmed from ${startTime}s to ${endTime}s (${endTime - startTime}s duration)`
            };
          } catch (error) {
            console.error("Failed to trim video:", error);
            return {
              success: false,
              error: "Failed to trim video",
            };
          }
        },
      },
      adjustSpeed: {
        description: "Change the playback speed of the video",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          speed: z.number().describe("Playback speed multiplier (0.5 to 2.0)"),
        }),
        execute: async ({ videoUrl, speed }) => {
          try {
            const editedUrl = await videoProcessor.adjustSpeed(videoUrl, speed);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              appliedSpeed: speed,
              message: `Video speed adjusted to ${speed}x`
            };
          } catch (error) {
            console.error("Failed to adjust video speed:", error);
            return {
              success: false,
              error: "Failed to adjust video speed",
            };
          }
        },
      },
      adjustBrightness: {
        description: "Adjust the brightness of the video",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          brightness: z.number().describe("Brightness adjustment value (-100 to 100)"),
        }),
        execute: async ({ videoUrl, brightness }) => {
          try {
            const editedUrl = await videoProcessor.adjustBrightness(videoUrl, brightness);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              appliedBrightness: brightness,
              message: `Video brightness adjusted by ${brightness > 0 ? '+' : ''}${brightness}`
            };
          } catch (error) {
            console.error("Failed to adjust brightness:", error);
            return {
              success: false,
              error: "Failed to adjust brightness",
            };
          }
        },
      },
      addText: {
        description: "Add text overlay to the video",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          text: z.string().describe("Text to overlay"),
          position: z.enum(["top", "center", "bottom"]).describe("Position of the text"),
          startTime: z.number().optional().describe("Start time in seconds"),
          endTime: z.number().optional().describe("End time in seconds"),
        }),
        execute: async ({ videoUrl, text, position, startTime, endTime }) => {
          try {
            const editedUrl = await videoProcessor.addText(videoUrl, text, position, startTime, endTime);
            const timeRange = startTime !== undefined && endTime !== undefined 
              ? ` from ${startTime}s to ${endTime}s` 
              : '';
            return {
              success: true,
              editedVideoUrl: editedUrl,
              addedText: text,
              message: `Added text "${text}" at ${position} position${timeRange}`
            };
          } catch (error) {
            console.error("Failed to add text:", error);
            return {
              success: false,
              error: "Failed to add text",
            };
          }
        },
      },
      cropVideo: {
        description: "Crop the video to specified dimensions",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          x: z.number().describe("X coordinate of crop start"),
          y: z.number().describe("Y coordinate of crop start"),
          width: z.number().describe("Width of crop"),
          height: z.number().describe("Height of crop"),
        }),
        execute: async ({ videoUrl, x, y, width, height }) => {
          try {
            const editedUrl = await videoProcessor.cropVideo(videoUrl, x, y, width, height);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              cropDimensions: { x, y, width, height },
              message: `Video cropped to ${width}x${height} starting at (${x}, ${y})`
            };
          } catch (error) {
            console.error("Failed to crop video:", error);
            return {
              success: false,
              error: "Failed to crop video",
            };
          }
        },
      },
      rotateVideo: {
        description: "Rotate the video by specified degrees",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          degrees: z.number().describe("Degrees to rotate (90, 180, 270)"),
        }),
        execute: async ({ videoUrl, degrees }) => {
          try {
            const editedUrl = await videoProcessor.rotateVideo(videoUrl, degrees);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              rotationDegrees: degrees,
              message: `Video rotated ${degrees} degrees`
            };
          } catch (error) {
            console.error("Failed to rotate video:", error);
            return {
              success: false,
              error: "Failed to rotate video",
            };
          }
        },
      },
      adjustVolume: {
        description: "Adjust the audio volume of the video",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          volume: z.number().describe("Volume multiplier (0.0 to 2.0)"),
        }),
        execute: async ({ videoUrl, volume }) => {
          try {
            const editedUrl = await videoProcessor.adjustVolume(videoUrl, volume);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              appliedVolume: volume,
              message: `Volume adjusted to ${Math.round(volume * 100)}%`
            };
          } catch (error) {
            console.error("Failed to adjust volume:", error);
            return {
              success: false,
              error: "Failed to adjust volume",
            };
          }
        },
      },
      applyFilter: {
        description: "Apply a basic filter to the video",
        parameters: z.object({
          videoUrl: z.string().describe("URL of the video"),
          filter: z.enum(["grayscale", "sepia", "blur", "sharpen"]).describe("Filter to apply"),
          intensity: z.number().optional().describe("Filter intensity (0.0 to 1.0)"),
        }),
        execute: async ({ videoUrl, filter, intensity = 1 }) => {
          try {
            const editedUrl = await videoProcessor.applyFilter(videoUrl, filter, intensity);
            return {
              success: true,
              editedVideoUrl: editedUrl,
              appliedFilter: filter,
              appliedIntensity: intensity,
              message: `Applied ${filter} filter with ${Math.round(intensity * 100)}% intensity`
            };
          } catch (error) {
            console.error("Failed to apply filter:", error);
            return {
              success: false,
              error: "Failed to apply filter",
            };
          }
        },
      },
    },
    onFinish: async ({ responseMessages }) => {
      if (session.user && session.user.id) {
        try {
          await saveChat({
            id,
            messages: [...coreMessages, ...responseMessages],
            userId: session.user.id,
          });
        } catch (error) {
          console.error("Failed to save chat");
        }
      }
    },
  });

  return result.toDataStreamResponse();
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
