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
  const [selectedMode, setSelectedMode] = useState<"in-place" | "full-editor" | null>(null);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [isFullEditor, setIsFullEditor] = useState(false);
  
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

  const handleModeSelect = () => {
    if (!editPrompt.trim()) {
      return; // Don't proceed if prompt is empty
    }
    setSelectedMode(isFullEditor ? "full-editor" : "in-place");
  };

  const renderMediaPreview = () => {
    if (!attachments?.length) return null;

    return (
      <div className="w-full rounded-lg overflow-hidden bg-muted/50 p-4">
        {/* Video Preview */}
        {hasVideo && (
          <div className="mb-4">
            {mediaAttachments.video.map((video) => (
              <video
                key={video.url}
                src={video.url}
                controls
                className="w-full rounded-lg mb-2"
                style={{ maxHeight: '300px' }}
              />
            ))}
          </div>
        )}

        {/* Image Grid */}
        {hasImages && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {mediaAttachments.image.map((image) => (
              <div key={image.url} className="relative aspect-square overflow-hidden rounded-md">
                <Image
                  src={image.url}
                  alt={image.name ?? "An image attachment"}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Audio Files */}
        {hasAudio && (
          <div className="space-y-2 mb-4">
            {mediaAttachments.audio.map((audio) => (
              <audio
                key={audio.url}
                src={audio.url}
                controls
                className="w-full"
              />
            ))}
          </div>
        )}

        {/* Edit Controls */}
        {(hasVideo || hasImages || hasAudio) && !selectedMode && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Toggle
                        pressed={isFullEditor}
                        onPressedChange={setIsFullEditor}
                        className="data-[state=on]:bg-primary"
                      >
                        {isFullEditor ? "Full Editor" : "Quick Edit"}
                      </Toggle>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Toggle between quick AI-powered edits and full editor mode</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder={isFullEditor 
                  ? "Describe what you want to create (e.g., 'Create a dynamic montage with smooth transitions')"
                  : "Describe your edits (e.g., 'Add subtitles and enhance the colors')"}
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleModeSelect}
                  disabled={!editPrompt.trim()}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  {isFullEditor ? "Open Editor" : "Apply Edits"}
                </Button>
              </div>
            </div>
          </div>
        )}
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

        {selectedMode === "full-editor" && (
          <FullVideoEditor
            videoFile={mediaAttachments.video?.[0] || null}
            imageFiles={mediaAttachments.image || []}
            audioFiles={mediaAttachments.audio || []}
            initialPrompt={editPrompt}
            onClose={() => setSelectedMode(null)}
          />
        )}

        {toolInvocations && (
          <div className="flex flex-col gap-4">
            {(() => {
              // Check if we have video editing tools
              const videoEditingTools = [
                'trimVideo', 'adjustSpeed', 'adjustBrightness', 'addText', 
                'cropVideo', 'rotateVideo', 'adjustVolume', 'applyFilter',
                'getVideoFromAttachments'
              ];
              
              // Find all video editing results
              const videoResults = toolInvocations
                .filter(inv => videoEditingTools.some(tool => 
                  inv.toolName.includes(tool) || inv.toolName === tool
                ));
              
              // Check if we have any pending video operations
              const pendingVideoOps = videoResults.filter(inv => inv.state === "call");
              const completedVideoOps = videoResults.filter(inv => inv.state === "result");
              
              // Show only the final video result (last successful one)
              const finalVideoResult = completedVideoOps
                .map(inv => ({ ...inv, result: inv.result as any }))
                .filter(inv => inv.result && typeof inv.result === 'object')
                .reverse()
                .find(inv => inv.result.success && (inv.result.videoUrl || inv.result.editedVideoUrl));
              
              const otherResults = toolInvocations
                .filter(inv => inv.state === "result")
                .filter(inv => !videoEditingTools.some(tool => 
                  inv.toolName.includes(tool) || inv.toolName === tool
                ));
              
              return (
                <>
                  {/* Show video processing indicator */}
                  {pendingVideoOps.length > 0 && (
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin text-zinc-500">
                          <LoaderIcon />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-800 dark:text-zinc-300">
                            Processing video...
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {completedVideoOps.length}/{videoResults.length} operations complete
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show final video result only when all operations are complete */}
                  {pendingVideoOps.length === 0 && finalVideoResult && (
                    <VideoResult
                      key={finalVideoResult.toolCallId}
                      result={finalVideoResult.result}
                    />
                  )}
                  
                  {/* Show other non-video tool results */}
                  {otherResults.map((toolInvocation) => {
                    const { toolName, toolCallId, result } = toolInvocation;
                    
                    if (toolName === "createReservation") {
                      return (
                        <CreateReservation
                          key={toolCallId}
                          result={result}
                        />
                      );
                    }

                    if (toolName === "listFlights") {
                      return (
                        <ListFlights
                          key={toolCallId}
                          result={result}
                        />
                      );
                    }

                    if (toolName === "selectSeats") {
                      return (
                        <SelectSeats
                          key={toolCallId}
                          result={result}
                        />
                      );
                    }

                    if (toolName === "authorizePayment") {
                      return (
                        <AuthorizePayment
                          key={toolCallId}
                          result={result}
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
                          result={result}
                        />
                      );
                    }

                    if (toolName === "flightStatus") {
                      return (
                        <FlightStatus
                          key={toolCallId}
                          result={result}
                        />
                      );
                    }

                    if (toolName === "getWeather") {
                      return (
                        <Weather
                          key={toolCallId}
                          result={result}
                        />
                      );
                    }
                    
                    // Fallback to JSON display for unknown tools
                    return (
                      <div key={toolCallId} className="rounded-lg bg-muted/50 p-4">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                          {toolName}
                        </div>
                        <pre className="text-xs overflow-auto text-slate-500">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </motion.div>
  );
};
