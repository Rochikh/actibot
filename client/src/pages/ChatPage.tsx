import { useChat } from "@/hooks/use-chat";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

export default function ChatPage() {
  const { messages, sendMessage, isLoading } = useChat();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-4xl mx-auto min-h-[600px] flex flex-col">
        <ScrollArea className="flex-1 p-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.message}
              response={message.response}
              timestamp={message.createdAt}
            />
          ))}
          {isLoading && (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
        </ScrollArea>
        <div className="p-4 border-t">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </Card>
    </div>
  );
}
