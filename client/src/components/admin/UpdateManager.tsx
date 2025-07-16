import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, FileText, Plus, RotateCcw, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UpdateManager() {
  const [updateType, setUpdateType] = useState<'incremental' | 'full_replacement'>('incremental');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    try {
      const response = await fetch('/api/admin/analyze-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Erreur lors de l\'analyse');

      const result = await response.json();
      setRecommendation(result);
      
      toast({
        title: "Analyse terminée",
        description: `${result.stats.addedLines} nouvelles lignes détectées`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/update-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateType }),
      });

      if (!response.ok) throw new Error('Erreur lors de la mise à jour');

      const result = await response.json();
      setLastUpdate(result);
      
      toast({
        title: "Mise à jour terminée",
        description: `${result.result.chunksCreated} chunks traités avec succès`,
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
        <h2 className="text-2xl font-bold">Gestionnaire de Mises à Jour</h2>
        <Button 
          onClick={handleAnalyze}
          variant="outline"
          size="sm"
        >
          <Info className="mr-2 h-4 w-4" />
          Analyser les changements
        </Button>
      </div>

      {recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Analyse des Changements
            </CardTitle>
            <CardDescription>
              Comparaison entre l'ancien et le nouveau contenu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {recommendation.stats.oldLines.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Anciennes lignes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {recommendation.stats.newLines.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Nouvelles lignes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  +{recommendation.stats.addedLines.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Ajoutées</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {recommendation.stats.percentageIncrease}%
                </div>
                <div className="text-sm text-muted-foreground">Augmentation</div>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recommandation:</strong> {recommendation.recommendation.reason}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Options de Mise à Jour</CardTitle>
          <CardDescription>
            Choisis comment traiter les nouvelles discussions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={updateType} onValueChange={setUpdateType}>
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="incremental" id="incremental" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="incremental" className="text-base font-medium cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-green-600" />
                    Mise à jour incrémentale
                    <Badge variant="secondary">Recommandé</Badge>
                  </div>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ajoute seulement les nouvelles discussions depuis la dernière mise à jour. 
                  Conserve tous les anciens chunks et ajoute les nouveaux.
                </p>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="text-green-600">+ Rapide</Badge>
                  <Badge variant="outline" className="text-green-600">+ Économique</Badge>
                  <Badge variant="outline" className="text-green-600">+ Préserve l'historique</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <RadioGroupItem value="full_replacement" id="full_replacement" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="full_replacement" className="text-base font-medium cursor-pointer">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-orange-600" />
                    Remplacement complet
                    <Badge variant="secondary">Nettoyage</Badge>
                  </div>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Supprime tous les anciens chunks et recrée tout depuis le fichier complet. 
                  Utile pour nettoyer et réorganiser.
                </p>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="text-orange-600">+ Propre</Badge>
                  <Badge variant="outline" className="text-orange-600">+ Cohérent</Badge>
                  <Badge variant="outline" className="text-red-600">- Plus lent</Badge>
                </div>
              </div>
            </div>
          </RadioGroup>

          <Separator />

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {updateType === 'incremental' 
                ? 'Ajoutera seulement les nouvelles discussions' 
                : 'Remplacera complètement le contenu existant'}
            </div>
            <Button 
              onClick={handleUpdate}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Lancer la mise à jour
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastUpdate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Dernière Mise à Jour
            </CardTitle>
            <CardDescription>
              Résultats de la dernière opération
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Type de mise à jour</span>
                <Badge variant={lastUpdate.updateType === 'incremental' ? 'default' : 'secondary'}>
                  {lastUpdate.updateType === 'incremental' ? 'Incrémentale' : 'Complète'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Chunks créés</span>
                <Badge variant="outline">{lastUpdate.result.chunksCreated}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Fichiers uploadés</span>
                <Badge variant="outline">{lastUpdate.result.uploadedFiles?.length || 0}</Badge>
              </div>
            </div>

            {lastUpdate.updateType === 'full_replacement' && lastUpdate.result.deletedFiles && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {lastUpdate.result.deletedFiles} anciens fichiers supprimés du Vector Store
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}