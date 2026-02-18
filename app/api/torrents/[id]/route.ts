import { NextRequest, NextResponse } from "next/server";
import { getTorrentByTopicId, getTorrentDetailsByTorrentId } from "@/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const torrent = await getTorrentByTopicId(params.id);

    if (!torrent) {
      return NextResponse.json({ error: "Torrent not found" }, { status: 404 });
    }

    const details = await getTorrentDetailsByTorrentId(params.id);

    const result = {
      ...torrent,
      detailsUrl: details?.url ?? null,
      description: details?.description ?? null,
      category: details?.category ?? null,
      forumName: details?.forumName ?? null,
      registeredUntil: details?.registeredUntil ?? null,
      detailsSeeders: details?.seeders ?? null,
      lastChecked: details?.lastChecked ?? null,
      magnetLink: details?.magnetLink ?? null,
      torrentFile: details?.torrentFile ?? null,
      detailsSize: details?.size ?? null,
      authorName: details?.authorName ?? null,
      authorPosts: details?.authorPosts ?? null,
      topicTitle: details?.topicTitle ?? null,
      year: details?.year ?? null,
      authorFirstName: details?.authorFirstName ?? null,
      authorLastName: details?.authorLastName ?? null,
      performer: details?.performer ?? null,
      series: details?.series ?? null,
      bookNumber: details?.bookNumber ?? null,
      genre: details?.genre ?? null,
      editionType: details?.editionType ?? null,
      audioCodec: details?.audioCodec ?? null,
      bitrate: details?.bitrate ?? null,
      duration: details?.duration ?? null,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
