import DocumentUpload from "@/components/admin/DocumentUpload";
import DocumentList from "@/components/admin/DocumentList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Document Management</h1>
        
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
