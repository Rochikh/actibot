import { format } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  message: string;
  response: string;
  timestamp: Date;
}

export default function ChatMessage({ message, response, timestamp }: ChatMessageProps) {
  // Fonction pour formater le texte avec des listes numérotées et du Markdown
  const formatResponse = (text: string) => {
    return text.split('\n').map((line, index) => {
      // Si la ligne est vide, on ajoute un espace
      if (!line.trim()) {
        return <div key={index} className="h-2" />;
      }

      // Si la ligne commence par un numéro et un point, on la formate comme un élément de liste
      const listItemMatch = line.match(/^(\d+)\.\s(.+)/);
      if (listItemMatch) {
        return (
          <div key={index} className="flex gap-2 my-1">
            <span className="font-medium text-primary">{listItemMatch[1]}.</span>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              className="prose prose-sm dark:prose-invert flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-primary prose-strong:text-primary prose-strong:font-bold prose-em:text-primary/80 prose-em:italic"
              components={{
                strong: ({ children }) => <span className="font-bold text-primary">{children}</span>,
                em: ({ children }) => <span className="italic text-primary/80">{children}</span>,
              }}
            >
              {listItemMatch[2]}
            </ReactMarkdown>
          </div>
        );
      }

      // Sinon, on affiche la ligne avec le formatage Markdown
      return (
        <ReactMarkdown 
          key={index}
          remarkPlugins={[remarkGfm]}
          className="prose prose-sm dark:prose-invert my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-primary prose-strong:text-primary prose-strong:font-bold prose-em:text-primary/80 prose-em:italic"
          components={{
            strong: ({ children }) => <span className="font-bold text-primary">{children}</span>,
            em: ({ children }) => <span className="italic text-primary/80">{children}</span>,
          }}
        >
          {line}
        </ReactMarkdown>
      );
    });
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
          <div className="text-sm text-foreground space-y-2">
            {formatResponse(response)}
          </div>
        </Card>
      </div>
    </div>
  );
}