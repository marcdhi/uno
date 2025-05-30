"use client";

import { Attachment, Message } from "ai";
import { useChat } from "ai/react";
import { useState } from "react";

import { Message as PreviewMessage } from "@/components/custom/message";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";

import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<Message>;
}) {
  const { messages, handleSubmit, input, setInput, append, isLoading, stop } =
    useChat({
      id,
      body: { id },
      initialMessages,
      maxSteps: 10,
      onFinish: () => {
        window.history.replaceState({}, "", `/chat/${id}`);
      },
    });

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [hasMedia, setHasMedia] = useState(false);

  return (
    <div className="flex flex-row justify-center pb-4 md:pb-8 h-dvh bg-background">
      <div className="flex flex-col justify-between items-center gap-4 w-full max-w-[500px]">
        {/* Messages Section */}
        <div
          ref={messagesContainerRef}
          className="flex flex-col gap-4 h-full w-full overflow-y-scroll px-4 md:px-0"
        >
          {messages.length === 0 && !hasMedia && (
            <div className="flex-1 flex items-center">
              <Overview />
            </div>
          )}

          {messages.map((message) => (
            <PreviewMessage
              key={message.id}
              chatId={id}
              role={message.role}
              content={message.content}
              attachments={message.experimental_attachments}
              toolInvocations={message.toolInvocations}
            />
          ))}

          <div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
        </div>

        {/* Input Section with Media Preview */}
        <div className="sticky bottom-0 w-full bg-background/80 backdrop-blur-sm pt-4">
          <form className="flex flex-col gap-4 px-4 md:px-0">
            <MultimodalInput
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={(newAttachments) => {
                setAttachments(newAttachments);
                setHasMedia(newAttachments.length > 0);
              }}
              messages={messages}
              append={append}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
