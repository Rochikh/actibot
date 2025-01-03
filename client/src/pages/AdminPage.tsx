import DocumentUpload from "@/components/admin/DocumentUpload";
import DocumentList from "@/components/admin/DocumentList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Link } from "wouter";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Document Management</h1>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="upload">
          <TabsList className="mb-4">
            <TabsTrigger value="upload">Upload Document</TabsTrigger>
            <TabsTrigger value="list">Document List</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <DocumentUpload />
          </TabsContent>

          <TabsContent value="list">
            <DocumentList />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}