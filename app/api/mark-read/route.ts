import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
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

    try {
      await client.connect();
      await client.getMailboxLock("INBOX");
      
      // Mark the specific UID as Seen (Read)
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      
    } catch (err: any) {
      console.error("IMAP Mark Read Error:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
      await client.logout();
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}