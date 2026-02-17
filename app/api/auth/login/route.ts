import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, upsertUser } from "@/db/queries";
import { sendMagicLinkEmail } from "@/lib/email";
import { createMagicLinkToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 },
      );
    }

    // Generate JWT magic link token (expires in 1 hour)
    const token = createMagicLinkToken(email);

    // Send magic link email
    const emailSent = await sendMagicLinkEmail(email, token);

    if (!emailSent) {
      // In development, still return success but log the token
      console.log(
        "[AUTH] DEV MODE - Magic link:",
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/verify?token=${token}`,
      );
    }

    return NextResponse.json({
      message: "Magic link sent to your email",
      // Only include in development
      ...(process.env.NODE_ENV === "development" && { devToken: token }),
    });
  } catch (error: any) {
    console.error("[AUTH] Login error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
