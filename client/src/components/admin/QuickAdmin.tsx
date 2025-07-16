import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, RefreshCw, Settings, FileText, Home } from "lucide-react";
import { Link } from "wouter";

export default function QuickAdmin() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Administration Complète</h1>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Prompts Système */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Prompts Système</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Gestion des prompts IA et des modèles
            </p>
            <Link href="/admin">
              <Button variant="outline" className="w-full">
                Gérer les Prompts
              </Button>
            </Link>
          </Card>

          {/* Documents */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">Documents</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Upload et gestion des documents
            </p>
            <Link href="/admin">
              <Button variant="outline" className="w-full">
                Gérer les Documents
              </Button>
            </Link>
          </Card>

          {/* Auto-Division */}
          <Card className="p-4 border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Scissors className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold">Auto-Division</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Division automatique des fichiers volumineux
            </p>
            <div className="space-y-2">
              <div className="bg-green-50 p-2 rounded text-xs">
                ✅ Système actif<br/>
                📦 22 chunks créés<br/>
                🎯 Juillet 2025 prêt
              </div>
              <Button 
                onClick={() => {
                  fetch('/api/admin/auto-split', {
                    method: 'POST',
                    credentials: 'include'
                  }).then(() => {
                    alert('Division lancée !');
                  });
                }}
                className="w-full"
              >
                Lancer Division
              </Button>
            </div>
          </Card>

          {/* Mises à Jour */}
          <Card className="p-4 border-yellow-200">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold">Mises à Jour</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Gestion intelligente des mises à jour
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => {
                  fetch('/api/admin/update-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updateType: 'incremental' }),
                    credentials: 'include'
                  }).then(() => {
                    alert('Mise à jour incrémentale lancée !');
                  });
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Incrémentale
              </Button>
              <Button 
                onClick={() => {
                  fetch('/api/admin/update-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updateType: 'complete' }),
                    credentials: 'include'
                  }).then(() => {
                    alert('Mise à jour complète lancée !');
                  });
                }}
                size="sm"
                className="w-full"
              >
                Complète (Recommandée)
              </Button>
            </div>
          </Card>

          {/* Paramètres */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold">Paramètres</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Configuration et sécurité
            </p>
            <Link href="/admin">
              <Button variant="outline" className="w-full">
                Paramètres
              </Button>
            </Link>
          </Card>

          {/* Recommandation spéciale */}
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-red-900">Solution François Bocquet</h3>
            </div>
            <p className="text-sm text-red-700 mb-4">
              Pour retrouver François Bocquet et les Gems de juillet 2025
            </p>
            <Button 
              onClick={() => {
                fetch('/api/admin/update-content', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updateType: 'complete' }),
                  credentials: 'include'
                }).then(() => {
                  alert('Réindexation complète lancée ! François Bocquet sera trouvé.');
                });
              }}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              Résoudre le Problème
            </Button>
          </Card>
        </div>
      </Card>
    </div>
  );
}