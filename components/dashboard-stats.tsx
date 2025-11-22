"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Users, MailOpen, ArrowRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  accounts: any[];
  emails: any[];
  onNavigateToAccount: (accountId: string) => void;
}

export function DashboardStats({ accounts, emails, onNavigateToAccount }: DashboardStatsProps) {
  // 1. Calculate Statistics
  const totalAccounts = accounts.length;
  const totalEmails = emails.length;
  const unreadEmails = emails.filter((email) => !email.flags.includes("\\Seen"));
  const totalUnread = unreadEmails.length;

  // 2. Calculate Unread per Account
  const accountsWithUnread = accounts.map((account) => {
    const count = unreadEmails.filter((email) => email.account_id === account.id).length;
    return {
      ...account,
      unreadCount: count,
    };
  }).filter(acc => acc.unreadCount > 0);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in-50 duration-500">
      
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening across your mailboxes today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard 
          title="Unread Mail" 
          value={totalUnread} 
          icon={Mail} 
          description="Messages waiting for action"
          trend="high" // Just for visual style
        />
        <StatsCard 
          title="All Mail" 
          value={totalEmails} 
          icon={MailOpen} 
          description="Total messages synced"
        />
        <StatsCard 
          title="Total Accounts" 
          value={totalAccounts} 
          icon={Users} 
          description="Active synced inboxes"
        />
      </div>

      {/* Unread Accounts Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Inboxes with Unread Mail</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountsWithUnread.length === 0 ? (
            <Card className="col-span-full bg-muted/50 border-dashed py-12 flex flex-col items-center justify-center text-center">
                <div className="p-4 rounded-full bg-background shadow-sm mb-4">
                    <Inbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">All caught up!</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                    You have zero unread messages across all your connected accounts.
                </p>
            </Card>
          ) : (
            accountsWithUnread.map((account) => (
              <div 
                key={account.id}
                onClick={() => onNavigateToAccount(account.id)}
                className="group cursor-pointer relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50"
              >
                <div className="p-6 flex flex-col justify-between h-full gap-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h4 className="font-semibold leading-none tracking-tight truncate pr-4">
                                {account.label}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                                {account.email}
                            </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Mail className="h-4 w-4" />
                        </div>
                    </div>
                    
                    <div className="pt-2 flex items-end justify-between">
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">{account.unreadCount}</span>
                            <span className="text-sm font-medium text-muted-foreground">unread</span>
                        </div>
                        <Button variant="ghost" size="icon" className="-mr-2 text-muted-foreground group-hover:text-foreground">
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable Stats Card Component
function StatsCard({ 
    title, 
    value, 
    icon: Icon, 
    description,
    trend 
}: { 
    title: string; 
    value: number; 
    icon: any; 
    description: string;
    trend?: "high" | "low"
}) {
    return (
        <Card className="overflow-hidden border-l-4 border-l-primary/0 hover:border-l-primary transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}