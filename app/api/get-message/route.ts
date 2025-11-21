import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decryptPassword } from "@/lib/encryption";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { account, uid } = await request.json();

    if (!account || !uid) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const realPassword = decryptPassword(account.encryptedPassword);

    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.port === 993,
      auth: {
        user: account.email,
        pass: realPassword,
      },
      logger: false,
    });

    let emailData = null;

    try {
      await client.connect();
      await client.getMailboxLock("INBOX");

      try {
        // CRITICAL FIX:
        // 1. Convert uid to string to be safe
        // 2. Pass { uid: true } so it searches by UID, not sequence number
        const messageId = String(uid);
        
        const message = await client.fetchOne(messageId, { 
          source: true, 
          uid: true 
        });

        if (!message) {
            throw new Error("Email not found on server");
        }

        if (message.source) {
          const parsed = await simpleParser(message.source);
          
          emailData = {
            subject: parsed.subject,
            from: parsed.from?.text,
            date: parsed.date,
            html: parsed.html || "", 
            text: parsed.textAsHtml || parsed.text || "",
          };
          
          // Mark as read if found
          try {
            await client.messageFlagsAdd(messageId, ["\\Seen"], { uid: true });
          } catch (flagErr) {
            console.warn("Could not mark as seen:", flagErr);
          }
        }

      } finally {
        // Lock is released on logout
      }
    } catch (err: any) {
      console.error("Fetch Body Error:", err);
      return NextResponse.json({ error: err.message || "Failed to fetch email" }, { status: 500 });
    } finally {
      await client.logout();
    }

    return NextResponse.json({ email: emailData });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}