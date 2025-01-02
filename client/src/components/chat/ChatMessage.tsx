import { format } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  message: string;
  response: string;
  timestamp: Date;
}

export default function ChatMessage({ message, response, timestamp }: ChatMessageProps) {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <User className="h-5 w-5" />
        </Avatar>
        <Card className="flex-1 p-3">
          <p className="text-sm">{message}</p>
          <time className="text-xs text-gray-400 mt-2">
            {format(new Date(timestamp), "HH:mm")}
          </time>
        </Card>
      </div>

      <div className="flex gap-3">
        <Avatar className="h-8 w-8 bg-primary">
          <Bot className="h-5 w-5" />
        </Avatar>
        <Card className="flex-1 p-3 bg-primary/5">
          <p className="text-sm whitespace-pre-wrap">{response}</p>
        </Card>
      </div>
    </div>
  );
}
