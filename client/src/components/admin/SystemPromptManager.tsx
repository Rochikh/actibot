import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Check, Pencil, X, Save } from "lucide-react";
import { OPENAI_MODELS, type SystemPrompt } from "@db/schema";

const MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-4o": "High-intelligence flagship model for complex, multi-step tasks",
  "gpt-4o-mini": "Affordable and intelligent small model for fast, lightweight tasks",
  "gpt-3.5-turbo": "Bon équilibre entre performance et coût",
  "gpt-4-vision-preview": "Spécialisé pour l'analyse d'images",
  "gpt-4": "Version standard de GPT-4",
  "gpt-3.5-turbo-16k": "Pour les conversations avec un long contexte",
};

export default function SystemPromptManager() {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [model, setModel] = useState<string>(OPENAI_MODELS[0]);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  const { data: prompts = [], isLoading } = useQuery<SystemPrompt[]>({
    queryKey: ["/api/system-prompts"],
  });

  const { mutateAsync: createPrompt, isPending: isCreating } = useMutation({
    mutationFn: async (data: { name: string; content: string; model: string }) => {
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
      setModel(OPENAI_MODELS[0]);
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

  const { mutateAsync: updatePrompt, isPending: isUpdating } = useMutation({
    mutationFn: async (data: { id: number; name: string; content: string; model: string }) => {
      const response = await fetch(`/api/system-prompts/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, content: data.content, model: data.model }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-prompts"] });
      setEditingPrompt(null);
      setIsEditing(false);
      toast({
        title: "Succès",
        description: "Le prompt système a été modifié",
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
    if (!name.trim() || !content.trim() || !model) return;

    if (editingPrompt) {
      await updatePrompt({ id: editingPrompt.id, name, content, model });
    } else {
      await createPrompt({ name, content, model });
    }
  };

  const startEditing = (prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setName(prompt.name);
    setContent(prompt.content);
    setModel(prompt.model);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditingPrompt(null);
    setName("");
    setContent("");
    setModel(OPENAI_MODELS[0]);
    setIsEditing(false);
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
          <Label htmlFor="model">Modèle OpenAI</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un modèle" />
            </SelectTrigger>
            <SelectContent>
              {OPENAI_MODELS.map((modelOption) => (
                <SelectItem key={modelOption} value={modelOption}>
                  <div>
                    <div className="font-medium">{modelOption}</div>
                    <div className="text-xs text-muted-foreground">
                      {MODEL_DESCRIPTIONS[modelOption]}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <div className="flex gap-2">
          <Button 
            type="submit" 
            disabled={isCreating || isUpdating || !name.trim() || !content.trim()} 
            className="flex-1"
          >
            {isCreating || isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : editingPrompt ? (
              <Save className="h-4 w-4 mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {editingPrompt ? "Enregistrer les modifications" : "Créer un nouveau prompt"}
          </Button>
          {isEditing && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={cancelEditing}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Annuler
            </Button>
          )}
        </div>
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Modèle</TableHead>
              <TableHead>Contenu</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((prompt) => (
              <TableRow key={prompt.id}>
                <TableCell className="font-medium">{prompt.name}</TableCell>
                <TableCell>{prompt.model}</TableCell>
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(prompt)}
                      disabled={isEditing}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!prompt.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => activatePrompt(prompt.id)}
                      >
                        Activer
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}