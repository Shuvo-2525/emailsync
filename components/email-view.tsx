"use client";

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { format } from "date-fns";
import { Loader2, X, Reply, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";

interface EmailViewProps {
  email: any | null;
  account: any | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to get webmail URL based on provider
const getWebmailLink = (provider: string, host: string) => {
  switch (provider) {
    case "titan":
      return "https://webmail.titan.email/";
    case "one":
      return "https://mail.one.com/";
    case "gmail":
      return "https://mail.google.com/";
    case "outlook":
      return "https://outlook.live.com/";
    default:
      // Fallback for custom hosts, try to guess or just use the host
      return `https://${host}`; 
  }
};

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
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load message body.");
      } finally {
        setLoading(false);
      }
    };

    fetchBody();
  }, [email, account, isOpen]);

  if (!email) return null;

  // Determine webmail link
  const webmailUrl = account ? getWebmailLink(account.provider, account.host) : "#";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 sm:duration-300 flex flex-col bg-white">
        {/* Header Section */}
        <SheetHeader className="p-6 pb-4 border-b text-left shrink-0">
          <div className="flex items-start justify-between mb-4">
             <div className="space-y-1">
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

        {/* Content Area */}
        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Fetching secure content...</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
               <div className="p-4 bg-red-50 rounded-full mb-4">
                 <AlertCircle className="h-8 w-8 text-red-500" />
               </div>
               <h3 className="text-lg font-semibold text-zinc-900 mb-2">Unable to Render Email</h3>
               <p className="text-sm text-muted-foreground max-w-xs mb-6">
                 This email contains complex data or server errors (like invalid IMAP messagesets) that cannot be displayed here.
               </p>
               
               <Button asChild className="w-full max-w-[200px]">
                 <a href={webmailUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                   Open Webmail <ExternalLink className="h-4 w-4" />
                 </a>
               </Button>

               {/* Debug info for developer */}
               <div className="mt-8 p-2 bg-zinc-100 rounded text-[10px] text-zinc-400 font-mono max-w-sm break-all">
                 Error: {error}
               </div>
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="p-6">
                <div 
                  className="email-content text-sm leading-relaxed text-zinc-800"
                  dangerouslySetInnerHTML={{ __html: fullBody }} 
                />
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}