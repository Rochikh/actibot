import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

export default function ChatPage() {
  const { messages, sendMessage, clearHistory, isLoading } = useChat();
  const { user, logout } = useUser();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-4xl mx-auto min-h-[600px] flex flex-col relative">
        <div className="absolute top-4 right-4 flex gap-2">
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
        <ScrollArea className="flex-1 p-4 mt-12">
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