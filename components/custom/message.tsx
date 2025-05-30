"use client";

import { Attachment, ToolInvocation } from "ai";
import { motion } from "framer-motion";
import { ReactNode, useState } from "react";
import { VideoEditorModes } from "./video-editor-modes";
import { FullVideoEditor } from "./video-editor/full-editor";
import { BotIcon, UserIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";
import { AuthorizePayment } from "../flights/authorize-payment";
import { DisplayBoardingPass } from "../flights/boarding-pass";
import { CreateReservation } from "../flights/create-reservation";
import { FlightStatus } from "../flights/flight-status";
import { ListFlights } from "../flights/list-flights";
import { SelectSeats } from "../flights/select-seats";
import { VerifyPayment } from "../flights/verify-payment";

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
  
  // Group attachments by type
  const mediaAttachments = attachments?.reduce((acc, att) => {
    const type = att.contentType?.split('/')[0] || 'other';
    return {
      ...acc,
      [type]: [...(acc[type] || []), att]
    };
  }, {} as Record<string, Attachment[]>) || {};

  const hasVideo = mediaAttachments.video?.length > 0;
  const hasImages = mediaAttachments.image?.length > 0;
  const hasAudio = mediaAttachments.audio?.length > 0;

  const handleModeSelect = (mode: "in-place" | "full-editor") => {
    setSelectedMode(mode);
    setShowModeSelection(false);
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
              <div key={image.url} className="aspect-square rounded-lg overflow-hidden">
                <img
                  src={image.url}
                  alt={image.name || "Uploaded image"}
                  className="w-full h-full object-cover"
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

        {/* Edit Button */}
        {(hasVideo || hasImages || hasAudio) && !showModeSelection && !selectedMode && (
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => setShowModeSelection(true)}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              {hasVideo ? "Edit Video" : "Create Video"}
            </button>
            <p className="text-sm text-muted-foreground text-center">
              {!hasVideo && "Create a video from your uploaded media"}
            </p>
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

        {(hasVideo || hasImages || hasAudio) && showModeSelection && (
          <VideoEditorModes
            videoFile={mediaAttachments.video?.[0] || null}
            imageFiles={mediaAttachments.image || []}
            audioFiles={mediaAttachments.audio || []}
            onModeSelect={handleModeSelect}
            onCancel={() => setShowModeSelection(false)}
          />
        )}

        {selectedMode === "full-editor" && (
          <FullVideoEditor
            videoFile={mediaAttachments.video?.[0] || null}
            imageFiles={mediaAttachments.image || []}
            audioFiles={mediaAttachments.audio || []}
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
