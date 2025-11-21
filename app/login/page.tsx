"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// Lucide icons come standard with Shadcn
import { Loader2, Mail } from "lucide-react"; 

export default function LoginPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  // Automatically redirect to dashboard if user is already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // The useEffect above will handle the redirect once 'user' state updates
    } catch (error) {
      // Error is handled by the AuthProvider logs for now
      console.error("Login failed", error);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <Card className="w-[380px] shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">EmailSync</CardTitle>
          <CardDescription>
            Unified dashboard for all your legacy emails
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Button 
              className="w-full" 
              onClick={handleLogin}
              size="lg"
            >
              Sign in with Google
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}