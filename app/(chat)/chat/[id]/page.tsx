import { Message } from "ai";
import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/custom/chat";
import { getChatById } from "@/db/queries";

interface MessageWithAttachments extends Message {
  attachments?: Array<{
    name: string;
    url: string;
    contentType?: string;
  }>;
}

export default async function ChatPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  const chat = await getChatById({ id: params.id });

  if (!chat) {
    redirect("/");
  }

  const messages = chat.messages as MessageWithAttachments[];

  return (
    <div className="flex-1 flex flex-col items-center">
      <Chat id={params.id} initialMessages={messages} />
    </div>
  );
}
