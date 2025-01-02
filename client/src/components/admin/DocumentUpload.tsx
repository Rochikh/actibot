import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";

export default function DocumentUpload() {
  const queryClient = useQueryClient();

  const { mutateAsync: uploadDocument, isPending: isUploading } = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await uploadDocument(file);
      } catch (error) {
        console.error("Upload failed:", error);
      }
    },
    [uploadDocument]
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center">
        <Upload className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Upload Document</h3>
        <p className="text-sm text-gray-500 mb-4">
          Supported formats: .txt, .md, .pdf
        </p>
        <Button disabled={isUploading} asChild>
          <label className="cursor-pointer">
            {isUploading ? "Uploading..." : "Select File"}
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        </Button>
      </div>
    </Card>
  );
}
