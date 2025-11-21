"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { encryptAccountData } from "@/app/actions";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";

export function AddAccountModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [provider, setProvider] = useState("titan");
  const [formData, setFormData] = useState({
    label: "",
    email: "",
    password: "",
    host: "imap.titan.email",
    port: "993",
  });

  // Handle Provider Change (Auto-fill defaults)
  const handleProviderChange = (value: string) => {
    setProvider(value);
    let newHost = "";
    let newPort = "993";

    if (value === "titan") {
      newHost = "imap.titan.email";
    } else if (value === "hostinger") {
      newHost = "imap.hostinger.com";
    } else if (value === "one") {
      newHost = "imap.one.com";
    } else {
      newHost = ""; // Custom requires user input
    }

    setFormData((prev) => ({ ...prev, host: newHost, port: newPort }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // 1. Validate Connection First
      const validationRes = await fetch("/api/check-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          host: formData.host,
          port: formData.port
        }),
      });

      const validationData = await validationRes.json();

      if (!validationRes.ok || !validationData.success) {
        throw new Error(validationData.error || "Failed to connect to mail server. Check credentials.");
      }

      // 2. Encrypt Password (Server Action)
      const payload = new FormData();
      payload.append("password", formData.password);
      const encryptedPassword = await encryptAccountData(payload);

      // 3. Save to Firestore
      await addDoc(collection(db, "users", user.uid, "mail_accounts"), {
        label: formData.label,
        email: formData.email,
        provider: provider,
        host: formData.host,
        port: parseInt(formData.port),
        encryptedPassword: encryptedPassword,
        createdAt: serverTimestamp(),
        lastCheck: null,
        unreadCount: 0,
      });

      toast.success("Account verified and added successfully");
      setOpen(false);
      
      // Reset form
      setFormData({
        label: "",
        email: "",
        password: "",
        host: "imap.titan.email",
        port: "993",
      });
    } catch (error: any) {
      console.error(error);
      // Show UI Alert
      toast.error(error.message || "Failed to verify account details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Add Account">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Email Account</DialogTitle>
          <DialogDescription>
            We'll verify your credentials before saving.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Account Label */}
          <div className="grid gap-2">
            <Label htmlFor="label">Account Name</Label>
            <Input
              id="label"
              placeholder="e.g. Work Email"
              value={formData.label}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value })
              }
              required
            />
          </div>

          {/* Provider Select */}
          <div className="grid gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="titan">Titan Email</SelectItem>
                <SelectItem value="hostinger">Hostinger</SelectItem>
                <SelectItem value="one">One.com</SelectItem>
                <SelectItem value="custom">Custom IMAP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email & Password */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@yourdomain.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="host">IMAP Host</Label>
              <Input
                id="host"
                value={formData.host}
                onChange={(e) =>
                  setFormData({ ...formData, host: e.target.value })
                }
                disabled={provider !== "custom"}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: e.target.value })
                }
                disabled={provider !== "custom"}
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="mt-2">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Verifying..." : "Verify & Save Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}