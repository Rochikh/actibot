import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useRef, useEffect } from "react";

export default function ChatPage() {
  const { messages, sendMessage, clearHistory, isLoading } = useChat();
  const { user, logout } = useUser();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-4xl mx-auto min-h-[600px] flex flex-col relative">
        {/* Input section at the top */}
        <div className="p-4 border-b">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>

        {/* Action buttons below input */}
        <div className="px-4 py-2 flex justify-end gap-2 border-b">
          {user?.isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Administration
              </Button>
            </Link>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearHistory}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Effacer
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => logout()}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>

        {/* Messages section */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message.message}
              response={message.response}
              timestamp={message.createdAt}
              isLoading={isLoading && index === messages.length - 1}
            />
          ))}
          {isLoading && messages.length === 0 && (
            <ChatMessage
              message=""
              response=""
              timestamp={new Date()}
              isLoading={true}
            />
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}