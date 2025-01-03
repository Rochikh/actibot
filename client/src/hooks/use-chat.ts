import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import type { Chat } from "@db/schema";

export function useChat() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { data: messages = [], refetch } = useQuery<Chat[]>({
    queryKey: ["/api/chat/history", user?.id],
    enabled: !!user,
  });

  const { mutateAsync: sendMessage, isPending: isLoading } = useMutation({
    mutationFn: async (message: string) => {
      if (!message || typeof message !== 'string') {
        throw new Error('Message must be a non-empty string');
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          message: message.trim(),
          history: messages.slice(-3).map(msg => ({ 
            role: msg.role || "user",
            content: msg.message
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history", user?.id] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearHistory = async () => {
    try {
      const response = await fetch("/api/chat/clear", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await refetch();
      toast({
        title: "Succès",
        description: "L'historique a été effacé",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  return {
    messages,
    sendMessage,
    clearHistory,
    isLoading,
  };
}