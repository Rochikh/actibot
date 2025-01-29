import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, loginUserSchema } from "@db/schema";
import type { InsertUser } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { toast } from "@/hooks/use-toast";
import * as z from 'zod';
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

type LoginFormData = z.infer<typeof loginUserSchema>;

export default function AuthPage() {
  const { login, register } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormData | InsertUser, action: "login" | "register") => {
    setIsLoading(true);
    try {
      if (action === "login") {
        await login(values as LoginFormData);
      } else {
        await register(values as InsertUser);
      }
    } catch (error) {
      // Display error toast immediately when login/register fails
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
      // Reset the password field on error
      if (action === "login") {
        loginForm.setValue("password", "");
      } else {
        registerForm.setValue("password", "");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showResetPassword) {
    return <ResetPasswordForm onCancel={() => setShowResetPassword(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold text-center">
            ActiBot
          </CardTitle>
          <CardDescription className="text-center text-sm space-y-2">
            <p>La réponse sera générée automatiquement par une IA paramétrée sur les échanges WhatsApp régulièrement mis à jour.</p>
            <p className="text-xs text-muted-foreground">
              En vous inscrivant, vous acceptez que vos données personnelles soient traitées conformément à notre politique de confidentialité. 
              Vos messages seront utilisés pour améliorer les réponses de l'IA.
              Vous pouvez exercer vos droits RGPD (accès, rectification, suppression) en contactant contact@rochane.fr
            </p>
          </CardDescription>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 mt-4"
            onClick={() => window.open("https://chat.whatsapp.com/Bpy9TORsbJ3LMKL4y6nBkj", "_blank")}
          >
            <SiWhatsapp className="w-5 h-5" />
            Rejoindre la communauté WhatsApp
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="register">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Form {...loginForm}>
                <form
                  onSubmit={loginForm.handleSubmit((values) => onSubmit(values, "login"))}
                  className="space-y-4"
                >
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Nom d'utilisateur</Label>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Mot de passe</Label>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Se connecter
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-sm text-muted-foreground"
                      onClick={() => setShowResetPassword(true)}
                      disabled={isLoading}
                    >
                      Mot de passe oublié ?
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="register">
              <Form {...registerForm}>
                <form
                  onSubmit={registerForm.handleSubmit((values) => onSubmit(values, "register"))}
                  className="space-y-4"
                >
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Nom d'utilisateur</Label>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Email</Label>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Mot de passe</Label>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    S'inscrire
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}