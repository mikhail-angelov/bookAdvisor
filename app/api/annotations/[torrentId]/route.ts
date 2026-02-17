import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getAnnotationByUserAndTorrent,
  upsertAnnotation,
  deleteAnnotation,
} from "@/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: { torrentId: string } },
) {
  try {
    const userId = request.cookies.get("user_id")?.value;
    const torrentId = params.torrentId;

    if (!userId) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 },
      );
    }

    const annotation = await getAnnotationByUserAndTorrent(userId, torrentId);

    return NextResponse.json({ data: annotation || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { torrentId: string } },
) {
  try {
    const userId = request.cookies.get("user_id")?.value;
    const torrentId = params.torrentId;

    if (!userId) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { rating, annotation, readStatus } = body;

    // Check if annotation exists
    const existing = await getAnnotationByUserAndTorrent(userId, torrentId);

    const result = await upsertAnnotation({
      id: existing?.id || uuidv4(),
      userId,
      torrentId,
      rating,
      annotation,
      readStatus,
      startedAt:
        readStatus === "reading" && !existing?.startedAt
          ? new Date().toISOString()
          : existing?.startedAt || undefined,
      completedAt:
        readStatus === "completed" && !existing?.completedAt
          ? new Date().toISOString()
          : existing?.completedAt || undefined,
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { torrentId: string } },
) {
  try {
    const userId = request.cookies.get("user_id")?.value;
    const torrentId = params.torrentId;

    if (!userId) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 },
      );
    }

    const existing = await getAnnotationByUserAndTorrent(userId, torrentId);

    if (existing) {
      await deleteAnnotation(existing.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
