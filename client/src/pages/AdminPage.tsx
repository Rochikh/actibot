import DocumentUpload from "@/components/admin/DocumentUpload";
import DocumentList from "@/components/admin/DocumentList";
import SystemPromptManager from "@/components/admin/SystemPromptManager";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import AutoSplitStatus from "@/components/admin/AutoSplitStatus";
import UpdateManager from "@/components/admin/UpdateManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Settings, FileText, Scissors, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useUser } from "@/hooks/use-user";

export default function AdminPage() {
  const { user } = useUser();
  
  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <Card className="max-w-md mx-auto p-6">
          <h1 className="text-xl font-bold text-center mb-4">Accès Administrateur Requis</h1>
          <p className="text-center text-gray-600 mb-4">
            Vous devez être connecté en tant qu'administrateur pour accéder à cette page.
          </p>
          <Link href="/auth">
            <Button className="w-full">Se connecter</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Administration</h1>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="prompts">
          <TabsList className="mb-4 flex flex-wrap gap-2">
            <TabsTrigger value="prompts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Prompts Système
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="auto-split" className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Auto-Division
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Mises à Jour
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Paramètres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prompts">
            <SystemPromptManager />
          </TabsContent>

          <TabsContent value="documents">
            <div className="space-y-6">
              <DocumentUpload />
              <DocumentList />
            </div>
          </TabsContent>

          <TabsContent value="auto-split">
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Scissors className="h-5 w-5" />
                  Auto-Division des Documents
                </h2>
                
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Statut du Système</h3>
                    <p className="text-sm text-blue-700">
                      ✅ Système d'auto-division actif<br/>
                      ✅ Seuil de division : 5000 lignes ou 1MB<br/>
                      ✅ Fichiers WhatsApp divisés par mois<br/>
                      ✅ Fichiers génériques divisés par blocs
                    </p>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-green-900 mb-2">Dernière Division</h3>
                    <p className="text-sm text-green-700">
                      📄 Fichier WhatsApp traité : 27,069 lignes<br/>
                      📦 Divisé en 22 chunks mensuels<br/>
                      🎯 Chunk juillet 2025 créé pour François Bocquet
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      fetch('/api/admin/auto-split', {
                        method: 'POST',
                        credentials: 'include'
                      }).then(() => {
                        window.location.reload();
                      });
                    }}
                    className="w-full"
                  >
                    Lancer Division Manuelle
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="updates">
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Gestionnaire de Mises à Jour
                </h2>
                
                <div className="space-y-4">
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="font-medium text-yellow-900 mb-2">Stratégies de Mise à Jour</h3>
                    <div className="space-y-2 text-sm text-yellow-700">
                      <p><strong>Incrémentale :</strong> Ajoute seulement les nouvelles discussions</p>
                      <p><strong>Complète :</strong> Remplace tout le contenu existant</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      onClick={() => {
                        fetch('/api/admin/update-content', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ updateType: 'incremental' }),
                          credentials: 'include'
                        }).then(() => {
                          window.location.reload();
                        });
                      }}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Mise à Jour Incrémentale
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        fetch('/api/admin/update-content', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ updateType: 'complete' }),
                          credentials: 'include'
                        }).then(() => {
                          window.location.reload();
                        });
                      }}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Mise à Jour Complète
                    </Button>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Recommandation</h3>
                    <p className="text-sm text-blue-700">
                      Pour résoudre le problème de François Bocquet (Gems juillet 2025), utilise la <strong>Mise à Jour Complète</strong> pour réindexer tous les chunks.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="max-w-md mx-auto">
              <ChangePasswordForm />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}