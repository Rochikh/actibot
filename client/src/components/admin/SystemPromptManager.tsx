import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Check } from "lucide-react";
import type { SystemPrompt } from "@db/schema";

export default function SystemPromptManager() {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const { data: prompts = [], isLoading } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/system-prompts"],
  });

  const { mutateAsync: createPrompt, isPending: isCreating } = useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      const response = await fetch("/api/system-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-prompts"] });
      setName("");
      setContent("");
      toast({
        title: "Succès",
        description: "Le prompt système a été créé",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutateAsync: activatePrompt } = useMutation({
    mutationFn: async (promptId: number) => {
      const response = await fetch(`/api/system-prompts/${promptId}/activate`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-prompts"] });
      toast({
        title: "Succès",
        description: "Le prompt système a été activé",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;

    await createPrompt({ name, content });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom du prompt</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Assistant Support Client"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Contenu du prompt</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Entrez les instructions pour l'assistant..."
            className="min-h-[100px]"
          />
        </div>

        <Button type="submit" disabled={isCreating} className="w-full">
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Créer un nouveau prompt
        </Button>
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Contenu</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((prompt) => (
              <TableRow key={prompt.id}>
                <TableCell className="font-medium">{prompt.name}</TableCell>
                <TableCell className="max-w-md truncate">{prompt.content}</TableCell>
                <TableCell>
                  {prompt.isActive ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      Actif
                    </span>
                  ) : (
                    "Inactif"
                  )}
                </TableCell>
                <TableCell>
                  {!prompt.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => activatePrompt(prompt.id)}
                    >
                      Activer
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
