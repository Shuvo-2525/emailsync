import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, host, port } = body;

    if (!email || !password || !host || !port) {
      return NextResponse.json(
        { error: "Missing connection details" },
        { status: 400 }
      );
    }

    const client = new ImapFlow({
      host: host,
      port: parseInt(port),
      secure: parseInt(port) === 993,
      auth: {
        user: email,
        pass: password,
      },
      logger: false,
    });

    // Wait for connection or error
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            client.close();
            reject(new Error("Connection timed out"));
        }, 10000);

        client.connect().then(() => {
            clearTimeout(timeout);
            client.logout();
            resolve();
        }).catch((err: any) => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Connection Check Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to connect to mail server" },
      { status: 400 }
    );
  }
}