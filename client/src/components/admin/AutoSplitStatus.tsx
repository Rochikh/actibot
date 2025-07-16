import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileText, Scissors, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AutoSplitStatus() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSplit, setLastSplit] = useState<any>(null);
  const { toast } = useToast();

  const handleManualSplit = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/auto-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Erreur lors de la division');

      const result = await response.json();
      setLastSplit(result);
      
      toast({
        title: "Division terminée",
        description: `${result.chunksCreated} parties créées avec succès`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Système d'Auto-Division</h2>
        <Button 
          onClick={handleManualSplit}
          disabled={isProcessing}
          variant="outline"
          size="sm"
        >
          {isProcessing ? (
            <>
              <Upload className="mr-2 h-4 w-4 animate-spin" />
              Division en cours...
            </>
          ) : (
            <>
              <Scissors className="mr-2 h-4 w-4" />
              Diviser manuellement
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Paramètres automatiques pour la division des fichiers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Limite de lignes</span>
              <Badge variant="secondary">5,000 lignes</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Limite de taille</span>
              <Badge variant="secondary">1 MB</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Type de division</span>
              <Badge variant="outline">Par période (WhatsApp)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Statut</span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">Actif</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Dernière Division
            </CardTitle>
            <CardDescription>
              Informations sur la dernière division automatique
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastSplit ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Fichier traité</span>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {lastSplit.originalFile}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Parties créées</span>
                  <Badge variant="success">{lastSplit.chunksCreated}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Fichiers uploadés</span>
                  <Badge variant="outline">{lastSplit.uploadedFiles.length}</Badge>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Aucune division récente
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comment ça marche</CardTitle>
          <CardDescription>
            Le système d'auto-division optimise les gros fichiers pour OpenAI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 rounded-full p-2">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Détection automatique</h4>
                <p className="text-sm text-muted-foreground">
                  Détecte les fichiers trop volumineux lors de l'upload
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-green-100 rounded-full p-2">
                <Scissors className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">Division intelligente</h4>
                <p className="text-sm text-muted-foreground">
                  Divise par périodes (WhatsApp) ou par blocs
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 rounded-full p-2">
                <Upload className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium">Upload optimisé</h4>
                <p className="text-sm text-muted-foreground">
                  Indexe automatiquement dans le Vector Store
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}