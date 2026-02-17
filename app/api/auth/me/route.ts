import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { getUserById } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get("auth_token")?.value;
    const userId = request.cookies.get("user_id")?.value;

    if (!authToken || !userId) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // Verify the session token
    let payload;
    try {
      payload = verifySessionToken(authToken);
    } catch (err) {
      // Token is invalid or expired
      return NextResponse.json({ authenticated: false, user: null });
    }

    // Get user from database
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error: any) {
    console.error("[AUTH] Me endpoint error:", error);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 },
    );
  }
}
