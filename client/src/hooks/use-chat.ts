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
      // Validate message before sending
      const trimmedMessage = message?.trim();
      if (!trimmedMessage) {
        throw new Error("Le message ne peut pas être vide");
      }

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            message: trimmedMessage,
            history: messages.slice(-3).map(msg => ({
              role: "user",
              content: msg.message
            }))
          }),
        });

        if (!response?.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Une erreur est survenue lors de l'envoi du message");
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Chat error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history", user?.id] });
    },
    onError: (error: Error) => {
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

      if (!response?.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Erreur lors de la suppression de l'historique");
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