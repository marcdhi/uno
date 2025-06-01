"use client";

import { Attachment, ToolInvocation } from "ai";
import { motion } from "framer-motion";
import Image from "next/image";
import { ReactNode, useState } from "react";

import { AuthorizePayment } from "../flights/authorize-payment";
import { DisplayBoardingPass } from "../flights/boarding-pass";
import { CreateReservation } from "../flights/create-reservation";
import { FlightStatus } from "../flights/flight-status";
import { ListFlights } from "../flights/list-flights";
import { SelectSeats } from "../flights/select-seats";
import { VerifyPayment } from "../flights/verify-payment";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Toggle } from "../ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

import { BotIcon, UserIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { FullVideoEditor } from "./video-editor/full-editor";
import { VideoEditorModes } from "./video-editor-modes";
import { Weather } from "./weather";
import { VideoResult } from "./video-result";
import { LoaderIcon } from "./icons";
import { SmartEditor } from "./smart-editor";
import { StyleSelector } from "./style-selector";

export const Message = ({
  chatId,
  role,
  content,
  toolInvocations,
  attachments,
}: {
  chatId: string;
  role: string;
  content: string | ReactNode;
  toolInvocations: Array<ToolInvocation> | undefined;
  attachments?: Array<Attachment>;
}) => {
  // Group attachments by type
  const mediaAttachments = attachments?.reduce((acc, att) => {
    if (!att.contentType) return acc;
    const type = att.contentType.split('/')[0];
    return {
      ...acc,
      [type]: [...(acc[type] || []), att]
    };
  }, {} as Record<string, Attachment[]>) || {};

  const hasVideo = mediaAttachments.video?.length > 0;
  const hasImages = mediaAttachments.image?.length > 0;
  const hasAudio = mediaAttachments.audio?.length > 0;

  const renderMediaPreview = () => {
    if (!hasVideo && !hasImages && !hasAudio) return null;

    return (
      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4">
          {/* Video previews */}
          {mediaAttachments.video?.map((attachment, index) => (
            <PreviewAttachment key={`video-${index}`} attachment={attachment} />
          ))}
          
          {/* Image previews */}
          {mediaAttachments.image?.map((attachment, index) => (
            <PreviewAttachment key={`image-${index}`} attachment={attachment} />
          ))}
          
          {/* Audio previews */}
          {mediaAttachments.audio?.map((attachment, index) => (
            <PreviewAttachment key={`audio-${index}`} attachment={attachment} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className={`flex flex-row gap-4 px-4 w-full md:w-[500px] md:px-0 first-of-type:pt-20`}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="size-[24px] border rounded-sm p-1 flex flex-col justify-center items-center shrink-0 text-zinc-500">
        {role === "assistant" ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-2 w-full">
        {content && typeof content === "string" && (
          <div className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4">
            <Markdown>{content}</Markdown>
          </div>
        )}

        {renderMediaPreview()}

        {toolInvocations && (
          <div className="flex flex-col gap-4">
            {(() => {
              // Check if we have video editing tools
              const videoEditingTools = [
                'trimVideo', 'adjustSpeed', 'adjustBrightness', 'addText', 
                'cropVideo', 'rotateVideo', 'adjustVolume', 'applyFilter',
                'batchEditVideo', 'applyVideoStyle', 'analyzeVideo',
                'applyCinematicStyle', 'applyVintageStyle', 'fastBrightness'
              ];
              
              // Filter out getVideoFromAttachments - it's just internal processing
              const relevantInvocations = toolInvocations.filter(inv => 
                inv.toolName !== 'getVideoFromAttachments'
              );
              
              // Find all video editing results
              const videoResults = relevantInvocations
                .filter(inv => videoEditingTools.some(tool => 
                  inv.toolName.includes(tool) || inv.toolName === tool
                ));
              
              // Check if we have any pending video operations
              const pendingVideoOps = videoResults.filter(inv => inv.state === "call");
              const completedVideoOps = videoResults.filter(inv => inv.state === "result");
              
              // Show processing status with more specific feedback
              if (pendingVideoOps.length > 0) {
                const currentOp = pendingVideoOps[0];
                let processingMessage = "Processing video...";
                
                // More specific messages based on operation type
                switch (currentOp.toolName) {
                  case 'batchEditVideo':
                    processingMessage = "Applying multiple edits to your video...";
                    break;
                  case 'applyVideoStyle':
                    processingMessage = "Applying cinematic style to your video...";
                    break;
                  case 'applyCinematicStyle':
                    processingMessage = "Applying cinematic style with professional color grading...";
                    break;
                  case 'applyVintageStyle':
                    processingMessage = "Applying vintage style with warm tones and film grain...";
                    break;
                  case 'fastBrightness':
                    processingMessage = "Adjusting video brightness...";
                    break;
                  case 'trimVideo':
                    processingMessage = "Trimming your video...";
                    break;
                  case 'adjustSpeed':
                    processingMessage = "Adjusting video speed...";
                    break;
                  case 'adjustBrightness':
                    processingMessage = "Enhancing video brightness...";
                    break;
                  case 'addText':
                    processingMessage = "Adding text overlay...";
                    break;
                  default:
                    processingMessage = "Processing your video...";
                }
                
                return (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin text-zinc-500">
                        <LoaderIcon />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-800 dark:text-zinc-300">
                          {processingMessage}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          This may take a moment...
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Show final video result only when all operations are complete
              const finalVideoResult = completedVideoOps
                .map(inv => ({ ...inv, result: inv.result as any }))
                .filter(inv => inv.result && typeof inv.result === 'object')
                .reverse()
                .find(inv => inv.result.success && (inv.result.videoUrl || inv.result.editedVideoUrl));
              
              if (finalVideoResult) {
                return (
                  <VideoResult
                    key={finalVideoResult.toolCallId}
                    result={finalVideoResult.result}
                  />
                );
              }
              
              // Show other non-video tool results
              const otherResults = relevantInvocations
                .filter(inv => inv.state === "result")
                .filter(inv => !videoEditingTools.some(tool => 
                  inv.toolName.includes(tool) || inv.toolName === tool
                ));
              
              return otherResults.map((toolInvocation) => {
                const { toolName, toolCallId, result } = toolInvocation;
                
                if (toolName === "createReservation") {
                  return (
                    <CreateReservation
                      key={toolCallId}
                      reservation={result}
                    />
                  );
                }

                if (toolName === "listFlights") {
                  return (
                    <ListFlights
                      key={toolCallId}
                      chatId={chatId}
                      results={result}
                    />
                  );
                }

                if (toolName === "selectSeats") {
                  return (
                    <SelectSeats
                      key={toolCallId}
                      chatId={chatId}
                      availability={result}
                    />
                  );
                }

                if (toolName === "authorizePayment") {
                  return (
                    <AuthorizePayment
                      key={toolCallId}
                      intent={result}
                    />
                  );
                }

                if (toolName === "verifyPayment") {
                  return (
                    <VerifyPayment
                      key={toolCallId}
                      result={result}
                    />
                  );
                }

                if (toolName === "displayBoardingPass") {
                  return (
                    <DisplayBoardingPass
                      key={toolCallId}
                      boardingPass={result}
                    />
                  );
                }

                if (toolName === "flightStatus") {
                  return (
                    <FlightStatus
                      key={toolCallId}
                      flightStatus={result}
                    />
                  );
                }

                if (toolName === "getWeather") {
                  return (
                    <Weather
                      key={toolCallId}
                      weatherAtLocation={result}
                    />
                  );
                }
                
                // Don't show fallback for unknown tools - keep it clean
                return null;
              });
            })()}
          </div>
        )}
      </div>
    </motion.div>
  );
};
