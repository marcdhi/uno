"use client";

import { Attachment, ChatRequestOptions, CreateMessage, Message } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  Dispatch,
  SetStateAction,
  ChangeEvent,
} from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Toggle } from "../ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

import { ArrowUpIcon, PaperclipIcon, StopIcon, VideoIcon } from "./icons";
import { ImageIcon } from "./icons";
import { AudioIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import useWindowSize from "./use-window-size";
import { FullVideoEditor } from "./video-editor/full-editor";
import { LoadingState } from "./loading-state";

export function MultimodalInput({
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  append,
  handleSubmit,
}: {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [mediaFile, setMediaFile] = useState<Attachment | null>(null);
  const [selectedMode, setSelectedMode] = useState<"in-place" | "full-editor" | null>(null);
  const [isFullEditor, setIsFullEditor] = useState(false);
  const [mediaType, setMediaType] = useState<"video" | "image" | "audio" | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      
      if (files.length === 0) {
        return;
      }

      setUploadQueue(files.map((file) => file.name));
      setIsUploading(true);

      const uploadFile = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch(`/api/files/upload`, {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            const { url, name, contentType } = data;

            const attachment = {
              url,
              name: name,
              contentType: contentType,
            };

            console.log("Upload successful, attachment:", attachment);

            // Set media type based on content type
            let detectedMediaType: "video" | "image" | "audio" | null = null;
            if (contentType.startsWith('video/')) {
              detectedMediaType = 'video';
            } else if (contentType.startsWith('image/')) {
              detectedMediaType = 'image';
            } else if (contentType.startsWith('audio/')) {
              detectedMediaType = 'audio';
            }

            setMediaType(detectedMediaType);
            setMediaFile(attachment);
            setAttachments([attachment]);
            
            console.log("State after upload:");
            console.log("- detectedMediaType:", detectedMediaType);
            console.log("- attachment being set as mediaFile:", attachment);
            console.log("- attachments array:", [attachment]);
            
            toast.success(`${detectedMediaType || 'File'} uploaded successfully!`);

            return attachment;
          } else {
            const { error } = await response.json();
            toast.error(error);
          }
        } catch (error) {
          toast.error("Failed to upload file, please try again!");
        } finally {
          setUploadQueue([]);
          setIsUploading(false);
        }
      };

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
        setIsUploading(false);
      }
    },
    [setAttachments],
  );

  const handleModeSelect = (mode: "in-place" | "full-editor") => {
    setSelectedMode(mode);
    
    if (mode === "in-place") {
      console.log("=== Creating message with attachment ===");
      console.log("Input content:", input);
      console.log("MediaFile state:", mediaFile);
      console.log("Attachments state:", attachments);
      
      const newMessage = {
        role: "user" as const,
        content: input,
      };
      
      console.log("Message being sent:", JSON.stringify(newMessage, null, 2));
      console.log("Attachments in options:", [mediaFile!]);
      
      // Pass attachments in the options parameter, not in the message
      append(newMessage, {
        experimental_attachments: [mediaFile!]
      });
      
      // Reset state after sending message
      setMediaFile(null);
      setMediaType(null);
      setAttachments([]);
      setSelectedMode(null);
    }

    setInput("");
  };

  const renderMediaPreview = () => {
    if (!mediaFile) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full rounded-lg overflow-hidden bg-muted/50 p-4"
      >
        {mediaType === 'video' && (
          <>
            <Tabs 
              defaultValue="quick-edit"
              value={isFullEditor ? "full-editor" : "quick-edit"}
              onValueChange={(value: string) => setIsFullEditor(value === "full-editor")}
              className="mb-4"
            >
              <TabsList className="w-full grid grid-cols-2 bg-muted/50 p-1">
                <TabsTrigger 
                  value="quick-edit"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Quick Edit
                </TabsTrigger>
                <TabsTrigger 
                  value="full-editor"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Full Editor
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}
        {mediaType === 'video' && (
          <video
            src={mediaFile.url}
            controls
            className="w-full rounded-lg"
            style={{ maxHeight: '300px' }}
          />
        )}
        {mediaType === 'image' && (
          <img
            src={mediaFile.url}
            alt={mediaFile.name}
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: '300px' }}
          />
        )}
        {mediaType === 'audio' && (
          <audio
            src={mediaFile.url}
            controls
            className="w-full mt-2"
          />
        )}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            {mediaFile.name}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMediaFile(null);
                setMediaType(null);
                setAttachments([]);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!input.trim()) {
                  toast.error("Please provide instructions!");
                  return;
                }
                handleModeSelect(isFullEditor ? "full-editor" : "in-place");
              }}
              disabled={!input.trim()}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {mediaType === 'video' && isFullEditor ? "Open Editor" : "Apply Changes"}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="relative w-full flex flex-col gap-4">
      {/* Loading State */}
      <AnimatePresence mode="wait">
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm"
          >
            <LoadingState />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Preview */}
      {renderMediaPreview()}

      {/* Input Area */}
      <div className="relative w-full">
        <Textarea
          ref={textareaRef}
          tabIndex={0}
          placeholder="Tell Glam what you'd like to create..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading) {
                // If there's a media file, use the attachment flow
                if (mediaFile) {
                  if (!input.trim()) {
                    toast.error("Please provide instructions!");
                    return;
                  }
                  handleModeSelect(isFullEditor ? "full-editor" : "in-place");
                } else {
                  handleSubmit();
                }
              }
            }
          }}
          rows={1}
          spellCheck={false}
          className="resize-none pr-32 py-3 scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch"
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          {!isLoading ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "video/*";
                    fileInputRef.current.click();
                  }
                }}
              >
                <VideoIcon className="size-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}
              >
                <ImageIcon className="size-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "audio/*";
                    fileInputRef.current.click();
                  }
                }}
              >
                <AudioIcon className="size-5" />
              </Button>
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  // If there's a media file, use the attachment flow
                  if (mediaFile) {
                    if (!input.trim()) {
                      toast.error("Please provide instructions!");
                      return;
                    }
                    handleModeSelect(isFullEditor ? "full-editor" : "in-place");
                  } else {
                    handleSubmit();
                  }
                }}
                disabled={!input.trim()}
              >
                <ArrowUpIcon className="size-5" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="shrink-0"
              onClick={() => stop()}
            >
              <StopIcon className="size-5" />
            </Button>
          )}
        </div>
      </div>

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple={false}
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {/* Full Editor */}
      {selectedMode === "full-editor" && mediaType === 'video' && (
        <FullVideoEditor
          videoFile={mediaFile}
          initialPrompt={input}
          onClose={() => {
            setSelectedMode(null);
          }}
        />
      )}
    </div>
  );
}
