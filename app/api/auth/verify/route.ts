import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getUserByEmail, upsertUser } from "@/db/queries";
import { verifyMagicLinkToken, createSessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/?error=missing_token", request.url),
      );
    }

    // Verify JWT magic link token
    let payload;
    try {
      payload = verifyMagicLinkToken(token);
    } catch (err: any) {
      console.error("[AUTH] Token verification failed:", err.message);
      return NextResponse.redirect(
        new URL("/?error=invalid_token", request.url),
      );
    }

    // Get or create user (email is lowercase from login)
    const email = payload.email?.toLowerCase();
    let user = await getUserByEmail(email);

    if (!user) {
      // Create new user
      const username = email.split("@")[0];
      user = await upsertUser({
        id: uuidv4(),
        username,
        email,
      });
    }

    // Create session JWT
    if (!user.email) {
      return NextResponse.redirect(
        new URL("/?error=invalid_user", request.url),
      );
    }
    const sessionToken = createSessionToken(user.id, user.email);

    // Set session cookie - 30 days
    const thirtyDaysInSeconds = 60 * 60 * 24 * 30;
    const response = NextResponse.redirect(
      new URL("/?logged_in=true", request.url),
    );

    response.cookies.set("auth_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: thirtyDaysInSeconds,
      path: "/",
    });

    response.cookies.set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: thirtyDaysInSeconds,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[AUTH] Verify error details:", {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
    });

    // Distinguish between database and token errors
    const errorType = error.message.includes("Database not initialized")
      ? "db_not_initialized"
      : error.message.includes("Invalid token")
        ? "invalid_token"
        : "verify_failed";

    return NextResponse.redirect(new URL(`/?error=${errorType}`, request.url));
  }
}
