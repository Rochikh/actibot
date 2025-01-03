import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import type { Chat } from "@db/schema";

export function useChat() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { data: messages = [] } = useQuery<Chat[]>({
    queryKey: ["/api/chat/history", user?.id],
    enabled: !!user,
  });

  const { mutateAsync: sendMessage, isPending: isLoading } = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
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

  return {
    messages,
    sendMessage,
    isLoading,
  };
}