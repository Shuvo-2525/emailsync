import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { decryptPassword } from "@/lib/encryption";

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

    const emails: any[] = [];
    
    const connectionTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), 10000)
    );

    try {
      await Promise.race([client.connect(), connectionTimeout]);

      // We must specifically open the inbox
      await client.getMailboxLock("INBOX");

      try {
        // Fetch all messages. 
        // Note: '1:*' gets everything.
        for await (const message of client.fetch("1:*", {
          envelope: true,
          uid: true,
          flags: true
        })) {
          emails.push({
            uid: message.uid,
            subject: message.envelope.subject,
            from: message.envelope.from[0]?.address || "Unknown",
            date: message.envelope.date,
            flags: Array.from(message.flags), // Convert Set to Array for serialization
            account_id: account.id,
          });
        }
      } finally {
        // Make sure to release the lock, but we are logging out anyway
      }
    } catch (err: any) {
      console.error(`IMAP Error for ${account.email}:`, err.message);
      return NextResponse.json({ emails: [], error: err.message });
    } finally {
      await client.logout();
    }

    // FIX: Handle undefined dates safely for TypeScript
    emails.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ emails });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}