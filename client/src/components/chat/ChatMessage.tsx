import { format } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Bot } from "lucide-react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  message: string;
  response: string;
  timestamp: Date;
  isLoading?: boolean;
}

export default function ChatMessage({ message, response, timestamp, isLoading }: ChatMessageProps) {
  // Fonction pour nettoyer le HTML et convertir en Markdown
  const cleanResponse = (text: string) => {
    return text
      .replace(/<\/?p>/g, '\n\n') // Remplacer les balises <p> par des sauts de ligne
      .replace(/<\/?strong>/g, '**') // Convertir <strong> en markdown
      .replace(/<\/?em>/g, '*') // Convertir <em> en markdown
      .replace(/<\/?br\/?>/g, '\n') // Convertir <br> en saut de ligne
      .replace(/&quot;/g, '"') // Convertir les entités HTML
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Message de l'utilisateur */}
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 bg-secondary">
          <User className="h-5 w-5" />
        </Avatar>
        <Card className="flex-1 p-4 bg-card">
          <p className="text-sm text-card-foreground">{message}</p>
          <time className="text-xs text-muted-foreground mt-2 block">
            {format(new Date(timestamp), "HH:mm")}
          </time>
        </Card>
      </div>

      {/* Réponse du bot */}
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 bg-primary">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </Avatar>
        <Card className="flex-1 p-4 bg-primary/5">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">
                L'assistant réfléchit...
              </p>
            </div>
          ) : (
            <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
                  em: ({ children }) => <em className="italic text-primary/80">{children}</em>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-4 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-4 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="pl-2">{children}</li>,
                }}
              >
                {cleanResponse(response)}
              </ReactMarkdown>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}