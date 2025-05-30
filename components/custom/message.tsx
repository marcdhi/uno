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
            {toolInvocations.map((toolInvocation) => {
              const { toolName, toolCallId, state } = toolInvocation;
              if (state === "result") {
                const { result } = toolInvocation;
                return (
                  <div key={toolCallId}>
                    <div>{JSON.stringify(result, null, 2)}</div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
