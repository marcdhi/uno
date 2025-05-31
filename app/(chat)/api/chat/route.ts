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
  
  // Don't use convertToCoreMessages - AI SDK now handles this automatically
  // This preserves experimental_attachments
  const result = await streamText({
    model: geminiProModel,
    system: `
        - You are Glam AI, a video editing assistant that helps users edit their videos using natural language commands
        - Keep your responses concise and focused on the editing task
        - After each tool call, briefly describe what was done
        - Ask for clarification if the user's request is ambiguous
        
        IMPORTANT WORKFLOW: When a user uploads a video and requests edits:
        1. FIRST call getVideoFromAttachments to extract the video URL from their message
        2. Use the returned videoUrl in subsequent video editing tool calls
        3. Then apply the requested edits using the appropriate tools
        
        DO NOT use placeholder URLs like "YOUR_VIDEO_URL" - always get the real URL first!
        
        Example workflow for "trim the first 20 seconds":
        1. Call getVideoFromAttachments to get the video URL
        2. Call trimVideo with the real URL, startTime: 20, and appropriate endTime
        
        - Here's the optimal flow for quick edits:
          1. Understand the user's editing request
          2. Extract the video URL using getVideoFromAttachments
          3. Apply basic video operations (trim, cut, speed, etc.)
          4. Apply enhancements if requested (brightness, color, etc.)
          5. Add overlays if needed (text, watermark)
          6. Provide the edited video URL to the user
        - Always be helpful and creative in your suggestions
      `,
    messages: coreMessages, // Pass messages directly instead of converting
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

  return result.toDataStreamResponse({});
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
