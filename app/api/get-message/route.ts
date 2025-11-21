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

    // 1. Decrypt Password
    const realPassword = decryptPassword(account.encryptedPassword);

    // 2. Connect
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
      let lock = await client.getMailboxLock("INBOX");

      try {
        // 3. Fetch the full message source for this specific UID
        // FIX: Added 'uid: true' so it knows we are passing a UID, not a sequence number
        const message = await client.fetchOne(uid, { 
          source: true, 
          uid: true 
        });

        if (message.source) {
          // 4. Parse the raw source into friendly HTML/Text
          const parsed = await simpleParser(message.source);
          
          emailData = {
            subject: parsed.subject,
            from: parsed.from?.text,
            date: parsed.date,
            html: parsed.html || "", // Prefer HTML
            text: parsed.textAsHtml || parsed.text || "", // Fallback to text
          };
          
          // Optional: Mark as read (\Seen)
          // FIX: Added 'uid: true' option here as well just in case, though messageFlagsAdd usually detects it or takes a generic set
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        }

      } finally {
        lock.release();
      }
    } catch (err: any) {
      console.error("Fetch Body Error:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
      await client.logout();
    }

    return NextResponse.json({ email: emailData });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}