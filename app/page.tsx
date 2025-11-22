"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { AddAccountModal } from "@/components/add-account-modal";
import { EmailView } from "@/components/email-view";
import { DashboardStats } from "@/components/dashboard-stats"; // Import our new component

import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut, Mail, Inbox, MailOpen, Trash2, LayoutDashboard, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  flags: string[];
  account_id: string;
}

type ViewMode = "dashboard" | "mailbox";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  
  // Data State
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Actions State
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [viewEmail, setViewEmail] = useState<EmailMessage | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // 1. Protect Route & Trigger Load Modal
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!hasLoadedInitial && accounts.length > 0) {
        // Only show modal if we have accounts but haven't loaded mail yet
        setShowLoadModal(true);
      }
    }
  }, [user, loading, router, hasLoadedInitial, accounts.length]);

  // 2. Listen for Accounts
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

  // 3. Fetch Mail Function
  const fetchAllMail = useCallback(async () => {
    if (accounts.length === 0) return;
    
    setIsFetching(true);
    // Close modal immediately when starting fetch
    setShowLoadModal(false); 
    setHasLoadedInitial(true);

    let allEmails: EmailMessage[] = [];

    // Use Promise.allSettled to ensure one failure doesn't stop others
    const promises = accounts.map(account => 
      fetch("/api/check-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      })
      .then(res => res.json())
      .then(data => data.emails || [])
      .catch(error => {
        console.error(`Failed to fetch for ${account.email}`, error);
        return [];
      })
    );

    const results = await Promise.all(promises);
    results.forEach((accountEmails) => {
      allEmails = [...allEmails, ...accountEmails];
    });

    allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEmails(allEmails);
    setIsFetching(false);
    toast.success("All inboxes synced successfully");
  }, [accounts]);

  // 4. Navigation Handlers
  const handleGoToOverview = () => {
    setViewMode("dashboard");
    setSelectedAccountId(null);
  };

  const handleGoToInbox = (accountId: string | null) => {
    setViewMode("mailbox");
    setSelectedAccountId(accountId);
  };

  // 5. Mark as Read & View
  const handleMarkAsRead = async (e: React.MouseEvent, email: EmailMessage) => {
    e.stopPropagation(); 
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
    }
  };

  const handleEmailClick = (email: EmailMessage) => {
    setViewEmail(email);
    setIsViewOpen(true);
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

  const handleDeleteAccount = async () => {
    if (!accountToDelete || !user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "mail_accounts", accountToDelete));
      toast.success("Account removed");
      if (selectedAccountId === accountToDelete) {
        handleGoToOverview();
      }
      setEmails(prev => prev.filter(e => e.account_id !== accountToDelete));
    } catch (error) {
      console.error("Delete error", error);
      toast.error("Failed to delete account");
    } finally {
      setAccountToDelete(null);
    }
  };

  const viewedAccount = viewEmail ? accounts.find(a => a.id === viewEmail.account_id) : null;
  const filteredEmails = selectedAccountId 
    ? emails.filter(e => e.account_id === selectedAccountId)
    : emails;

  return (
    <div className="flex h-[100dvh] w-full flex-col md:flex-row overflow-hidden bg-background">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-zinc-50 border-r p-4 flex flex-col h-full shrink-0">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Mail className="text-white h-4 w-4" />
            </div>
            EmailSync
          </h2>
          <AddAccountModal />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2">
          {/* Overview Tab */}
          <button
            onClick={handleGoToOverview}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors font-medium mb-4 ${
              viewMode === "dashboard"
                ? "bg-primary/10 text-primary"
                : "hover:bg-zinc-200/50 text-zinc-700"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </button>

          <div className="text-xs font-semibold text-muted-foreground px-3 mb-2 uppercase tracking-wider">
            Inboxes
          </div>

          <button
            onClick={() => handleGoToInbox(null)}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors ${
              viewMode === "mailbox" && selectedAccountId === null
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-zinc-200/50 text-zinc-700"
            }`}
          >
            <Inbox className="h-4 w-4" />
            <span>All Inboxes</span>
          </button>

          {accounts.map((account) => (
            <div 
              key={account.id}
              className={`group flex items-center w-full rounded-md transition-colors ${
                viewMode === "mailbox" && selectedAccountId === account.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-zinc-200/50 text-zinc-700"
              }`}
            >
              <button
                onClick={() => handleGoToInbox(account.id)}
                className="flex-1 flex items-center space-x-3 px-3 py-2 text-sm min-w-0"
              >
                {/* Provider Icon Placeholder or Generic Mail */}
                <Mail className="h-4 w-4 shrink-0 opacity-70" />
                <div className="flex-1 text-left truncate">
                  <p className="truncate">{account.label}</p>
                </div>
              </button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 mr-1"
                onClick={() => setAccountToDelete(account.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t mt-auto shrink-0">
           <div className="text-xs text-muted-foreground truncate font-mono bg-zinc-200/50 p-1 rounded mb-2 text-center">
            {user?.email}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-white h-full">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-bold text-zinc-800">
            {viewMode === "dashboard" 
              ? "Dashboard" 
              : selectedAccountId 
                ? accounts.find(a => a.id === selectedAccountId)?.label 
                : "Unified Inbox"}
          </h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAllMail} 
            disabled={isFetching || accounts.length === 0}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Syncing...' : 'Sync Mail'}
          </Button>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50/50">
          {viewMode === "dashboard" ? (
            // DASHBOARD VIEW
            <DashboardStats 
              accounts={accounts} 
              emails={emails} 
              onNavigateToAccount={(id) => handleGoToInbox(id)} 
            />
          ) : (
            // MAILBOX VIEW
            <div className="p-0">
              {accounts.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground space-y-4">
                   <div className="p-6 bg-zinc-100 rounded-full"><Mail className="h-10 w-10 text-zinc-300" /></div>
                   <p>Add an account to get started</p>
                 </div>
              ) : filteredEmails.length === 0 && !isFetching ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                  <p>No emails found (try syncing)</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 bg-white">
                  {filteredEmails.map((email) => {
                    const isRead = email.flags && email.flags.includes('\\Seen');
                    return (
                      <div 
                        key={email.uid + email.account_id} 
                        onClick={() => handleEmailClick(email)}
                        className={`flex items-start p-4 hover:bg-zinc-50 cursor-pointer group transition-colors relative ${!isRead ? 'bg-blue-50/30' : ''}`}
                      >
                        {!isRead && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full shadow-sm" />
                        )}
                        <div className="flex-1 min-w-0 pl-4">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm truncate pr-2 ${!isRead ? 'text-zinc-900 font-bold' : 'text-zinc-700 font-medium'}`}>
                              {email.from.replace(/"/g, '').split('<')[0]}
                            </p>
                            <div className="flex items-center gap-3">
                               <span className="text-xs text-zinc-400 whitespace-nowrap">
                                {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                               </span>
                               {!isRead && (
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-6 w-6 text-zinc-400 hover:text-blue-600 hover:bg-blue-100 -mr-2"
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
          )}
        </div>
      </main>

      {/* Load Mail Modal (Shows on startup) */}
      <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Welcome Back</DialogTitle>
            <DialogDescription>
              Would you like to load your latest emails now?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-between gap-2">
             <Button variant="ghost" onClick={() => setShowLoadModal(false)}>
               Skip for now
             </Button>
             <Button onClick={fetchAllMail} className="w-full sm:w-auto gap-2">
               <RefreshCw className="h-4 w-4" /> Load All Mail
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Other Modals */}
      <EmailView 
        email={viewEmail} 
        account={viewedAccount} 
        isOpen={isViewOpen} 
        onClose={() => setIsViewOpen(false)} 
      />

      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the account from your dashboard. You can add it back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}