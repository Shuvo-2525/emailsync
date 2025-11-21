"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { AddAccountModal } from "@/components/add-account-modal";
import { EmailView } from "@/components/email-view";

import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut, Mail, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface MailAccount {
  id: string;
  label: string;
  email: string;
  unreadCount: number;
  provider: string;
  host: string;
  port: number;
  encryptedPassword: any;
}

interface EmailMessage {
  uid: string;
  subject: string;
  from: string;
  date: string;
  flags: Set<string>;
  account_id: string;
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Viewer State
  const [viewEmail, setViewEmail] = useState<EmailMessage | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Protect Route
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // 1. Listen for Accounts
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "mail_accounts"), 
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MailAccount[];
      setAccounts(accountsData);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. The Polling Function
  const fetchAllMail = useCallback(async () => {
    if (accounts.length === 0) return;
    
    setIsFetching(true);
    let allEmails: EmailMessage[] = [];

    const promises = accounts.map(async (account) => {
      try {
        const response = await fetch("/api/check-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account }),
        });
        
        const data = await response.json();
        if (data.emails) {
          return data.emails;
        }
        return [];
      } catch (error) {
        console.error(`Failed to fetch for ${account.email}`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach((accountEmails) => {
      allEmails = [...allEmails, ...accountEmails];
    });

    allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEmails(allEmails);
    setIsFetching(false);
    toast.success("Inbox updated");
  }, [accounts]);

  // 3. Handle Email Click
  const handleEmailClick = (email: EmailMessage) => {
    setViewEmail(email);
    setIsViewOpen(true);
  };

  const viewedAccount = viewEmail 
    ? accounts.find(a => a.id === viewEmail.account_id) 
    : null;

  const filteredEmails = selectedAccountId 
    ? emails.filter(e => e.account_id === selectedAccountId)
    : emails;

  return (
    // Updated to use h-[100dvh] for mobile consistency and overflow-hidden to trap scrollbars
    <div className="flex h-[100dvh] w-full flex-col md:flex-row overflow-hidden bg-background">
      
      {/* SIDEBAR (Accounts) */}
      <aside className="w-full md:w-64 bg-zinc-50 border-r p-4 flex flex-col h-full shrink-0">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="font-bold text-lg tracking-tight">Accounts</h2>
          <AddAccountModal />
        </div>

        {/* flex-1 min-h-0 ensures this div takes remaining space but allows internal scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2">
          <button
            onClick={() => setSelectedAccountId(null)}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors ${
              selectedAccountId === null
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-zinc-200/50 text-zinc-700"
            }`}
          >
            <Inbox className="h-4 w-4" />
            <span>All Inboxes</span>
          </button>

          <div className="h-px bg-zinc-200 my-2" />

          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setSelectedAccountId(account.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors ${
                selectedAccountId === account.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-zinc-200/50 text-zinc-700"
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <div className="flex-1 text-left truncate">
                <p className="truncate">{account.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{account.email}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t mt-auto shrink-0">
           <div className="text-xs text-muted-foreground truncate font-mono bg-zinc-200/50 p-1 rounded mb-2">
            {user?.email}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-red-600"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT (Email List) */}
      <main className="flex-1 flex flex-col min-w-0 bg-white h-full">
        <header className="h-16 border-b flex items-center justify-between px-6 shrink-0">
          <h1 className="text-xl font-bold">
            {selectedAccountId 
              ? accounts.find(a => a.id === selectedAccountId)?.label 
              : "Unified Inbox"}
          </h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAllMail} 
            disabled={isFetching || accounts.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Syncing...' : 'Refresh'}
          </Button>
        </header>

        {/* flex-1 min-h-0 for proper scrolling behavior */}
        <div className="flex-1 min-h-0 overflow-y-auto p-0">
          {accounts.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
               <div className="p-6 bg-zinc-100 rounded-full"><Mail className="h-10 w-10 text-zinc-300" /></div>
               <p>Add an account to get started</p>
             </div>
          ) : filteredEmails.length === 0 && !isFetching ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>No emails found (or try clicking Refresh)</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filteredEmails.map((email) => (
                <div 
                  key={email.uid + email.account_id} 
                  onClick={() => handleEmailClick(email)}
                  className="flex items-start p-4 hover:bg-zinc-50 cursor-pointer group transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-zinc-900 truncate pr-2">
                        {email.from.split('<')[0].replace(/"/g, '')}
                      </p>
                      <span className="text-xs text-zinc-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                      </span>
                    </div>
                    <h4 className="text-sm text-zinc-700 truncate group-hover:text-zinc-900">
                      {email.subject || "(No Subject)"}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <EmailView 
        email={viewEmail} 
        account={viewedAccount} 
        isOpen={isViewOpen} 
        onClose={() => setIsViewOpen(false)} 
      />
    </div>
  );
}