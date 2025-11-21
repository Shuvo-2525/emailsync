import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { decryptPassword } from "@/lib/encryption";

// Force Node.js runtime because IMAP requires TCP sockets (not available in Edge)
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account } = body;

    if (!account || !account.encryptedPassword) {
      return NextResponse.json(
        { error: "Missing account configuration" },
        { status: 400 }
      );
    }

    // 1. Decrypt the password "Just In Time"
    // This password exists in memory for milliseconds only
    const realPassword = decryptPassword(account.encryptedPassword);

    // 2. Initialize the IMAP Client
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.port === 993, // True for 993, False for 143
      auth: {
        user: account.email,
        pass: realPassword,
      },
      logger: false, // Turn off noisy logs
    });

    // 3. Connect and Fetch
    const emails = [];
    
    // Time out after 10 seconds to prevent hanging
    const connectionTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), 10000)
    );

    try {
      await Promise.race([client.connect(), connectionTimeout]);

      // Open Inbox in Read-Only mode (safer/faster)
      const lock = await client.getMailboxLock("INBOX");

      try {
        // Fetch the latest 20 messages (You can filter for {seen: false} here if you want only unread)
        // We fetch 'envelope' (headers) which is fast. Body is fetched only when clicked.
        for await (const message of client.fetch("1:*", {
          envelope: true,
          uid: true,
          flags: true
        })) {
          emails.push({
            uid: message.uid,
            subject: message.envelope.subject,
            from: message.envelope.from[0].address, // Simplification: just get the first sender
            date: message.envelope.date,
            flags: message.flags,
            account_id: account.id, // Tag it so we know which account it belongs to
          });
        }
      } finally {
        lock.release();
      }
    } catch (err: any) {
      console.error(`IMAP Error for ${account.email}:`, err.message);
      // Return empty array instead of crashing, so other accounts still load
      return NextResponse.json({ emails: [], error: err.message });
    } finally {
      await client.logout();
    }

    // Sort by date (newest first) before returning
    emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ emails });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}