"use server";

import { encryptPassword } from "@/lib/encryption";

/**
 * ENCRYPT ACCOUNT DATA
 * This function runs entirely on the server.
 * It takes the raw password, encrypts it, and returns the encrypted object.
 * We will then save this encrypted object to Firestore from the client.
 */
export async function encryptAccountData(formData: FormData) {
  const password = formData.get("password") as string;

  if (!password) {
    throw new Error("Password is required");
  }

  try {
    // Use the function we created in Step 2
    const encryptedData = encryptPassword(password);
    
    // Return plain objects (Next.js Server Actions must return serializable data)
    return {
      iv: encryptedData.iv,
      content: encryptedData.content,
      tag: encryptedData.tag,
    };
  } catch (error) {
    console.error("Encryption Failed:", error);
    throw new Error("Failed to encrypt password. Check server logs.");
  }
}