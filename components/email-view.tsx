"use client";

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { format } from "date-fns";
import { Loader2, X, Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription, // Added for accessibility completeness
  SheetClose,
} from "@/components/ui/sheet";

interface EmailViewProps {
  email: any | null;
  account: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmailView({ email, account, isOpen, onClose }: EmailViewProps) {
  const [loading, setLoading] = useState(false);
  const [fullBody, setFullBody] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBody = async () => {
      if (!email || !account || !isOpen) return;

      setLoading(true);
      setError(null);
      setFullBody("");

      try {
        const res = await fetch("/api/get-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            account: account, 
            uid: email.uid 
          }),
        });

        const data = await res.json();

        if (data.error) throw new Error(data.error);

        const cleanHtml = DOMPurify.sanitize(data.email.html || data.email.text || "<div>No content</div>", {
          USE_PROFILES: { html: true },
          ADD_TAGS: ["style"],
          ADD_ATTR: ["target"],
        });

        setFullBody(cleanHtml);
      } catch (err) {
        console.error(err);
        setError("Failed to load message body.");
      } finally {
        setLoading(false);
      }
    };

    fetchBody();
  }, [email, account, isOpen]);

  if (!email) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 sm:duration-300 flex flex-col">
        {/* Header Section - Fixed for Accessibility */}
        <SheetHeader className="p-6 pb-4 border-b text-left">
          <div className="flex items-start justify-between mb-4">
             <div className="space-y-1">
                {/* SheetTitle is required for DialogContent accessibility */}
                <SheetTitle className="font-semibold text-lg leading-tight">
                  {email.subject || "(No Subject)"}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {email.from}
                </SheetDescription>
             </div>
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled>
                    <Reply className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled>
                    <Trash2 className="h-4 w-4" />
                </Button>
             </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
             <span>{format(new Date(email.date), "PPpp")}</span>
             <span className="bg-zinc-100 px-2 py-1 rounded text-zinc-500">
                {account?.label || "Inbox"}
             </span>
          </div>
        </SheetHeader>

        {/* Email Body Scroll Area */}
        <ScrollArea className="flex-1 bg-white">
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>Fetching secure content...</p>
              </div>
            ) : error ? (
              <div className="text-red-500 py-10 text-center bg-red-50 rounded-md">
                <p>{error}</p>
              </div>
            ) : (
              <div 
                className="email-content text-sm leading-relaxed text-zinc-800"
                dangerouslySetInnerHTML={{ __html: fullBody }} 
              />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}