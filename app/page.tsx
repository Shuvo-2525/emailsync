"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { AddAccountModal } from "@/components/add-account-modal";
import { EmailView } from "@/components/email-view";

import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut, Mail, Inbox, MailOpen } from "lucide-react";
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
  flags: string[]; // Changed from Set<string> to string[] for JSON compatibility
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

  // 3. Mark as Read Function
  const handleMarkAsRead = async (e: React.MouseEvent, email: EmailMessage) => {
    e.stopPropagation(); // Prevent opening the email view

    // Optimistic UI Update
    setEmails((prev) => 
      prev.map((msg) => 
        msg.uid === email.uid && msg.account_id === email.account_id 
          ? { ...msg, flags: [...msg.flags, '\\Seen'] } 
          : msg
      )
    );

    try {
      const account = accounts.find(a => a.id === email.account_id);
      if (!account) return;

      await fetch("/api/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, uid: email.uid }),
      });
      toast.success("Marked as read");
    } catch (error) {
      console.error("Failed to mark as read", error);
      toast.error("Failed to update status on server");
    }
  };

  // 4. Handle Email Click (Opens View and marks as read locally)
  const handleEmailClick = (email: EmailMessage) => {
    setViewEmail(email);
    setIsViewOpen(true);
    
    // Mark as read in local state immediately when opening
    if (!email.flags.includes('\\Seen')) {
        setEmails((prev) => 
            prev.map((msg) => 
              msg.uid === email.uid && msg.account_id === email.account_id 
                ? { ...msg, flags: [...msg.flags, '\\Seen'] } 
                : msg
            )
        );
    }
  };

  const viewedAccount = viewEmail 
    ? accounts.find(a => a.id === viewEmail.account_id) 
    : null;

  const filteredEmails = selectedAccountId 
    ? emails.filter(e => e.account_id === selectedAccountId)
    : emails;

  return (
    <div className="flex h-[100dvh] w-full flex-col md:flex-row overflow-hidden bg-background">
      
      {/* SIDEBAR (Accounts) */}
      <aside className="w-full md:w-64 bg-zinc-50 border-r p-4 flex flex-col h-full shrink-0">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="font-bold text-lg tracking-tight">Accounts</h2>
          <AddAccountModal />
        </div>

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
              {filteredEmails.map((email) => {
                const isRead = email.flags && email.flags.includes('\\Seen');
                
                return (
                  <div 
                    key={email.uid + email.account_id} 
                    onClick={() => handleEmailClick(email)}
                    className={`flex items-start p-4 hover:bg-zinc-50 cursor-pointer group transition-colors relative ${!isRead ? 'bg-blue-50/30' : ''}`}
                  >
                    {/* Unread Indicator Dot */}
                    {!isRead && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                    )}

                    <div className="flex-1 min-w-0 pl-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm font-medium truncate pr-2 ${!isRead ? 'text-zinc-900 font-bold' : 'text-zinc-700'}`}>
                          {email.from.split('<')[0].replace(/"/g, '')}
                        </p>
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-zinc-400 whitespace-nowrap">
                            {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                           </span>
                           {/* Mark as Read Button */}
                           {!isRead && (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-6 w-6 text-zinc-400 hover:text-blue-600 hover:bg-blue-100"
                               title="Mark as read"
                               onClick={(e) => handleMarkAsRead(e, email)}
                             >
                               <MailOpen className="h-3 w-3" />
                             </Button>
                           )}
                        </div>
                      </div>
                      <h4 className={`text-sm truncate group-hover:text-zinc-900 ${!isRead ? 'text-zinc-800 font-semibold' : 'text-zinc-500'}`}>
                        {email.subject || "(No Subject)"}
                      </h4>
                    </div>
                  </div>
                );
              })}
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