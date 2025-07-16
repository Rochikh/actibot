import { Switch, Route, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";
import QuickAdmin from "./components/admin/QuickAdmin";
import { useUser } from "@/hooks/use-user";

function App() {
  const { user, isLoading } = useUser();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Redirect non-admin users trying to access /admin
  if ((location === '/admin' || location === '/admin-quick') && !user.isAdmin) {
    setLocation('/');
    return null;
  }

  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin-quick" component={QuickAdmin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            The page you are looking for does not exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;