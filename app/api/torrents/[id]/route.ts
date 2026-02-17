import { NextRequest, NextResponse } from "next/server";
import { getTorrentById, getTorrentDetailsByTorrentId } from "@/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const torrent = await getTorrentById(params.id);

    if (!torrent) {
      return NextResponse.json({ error: "Torrent not found" }, { status: 404 });
    }

    const details = await getTorrentDetailsByTorrentId(params.id);

    const result = {
      ...torrent,
      details_url: details?.url ?? null,
      description: details?.description ?? null,
      category: details?.category ?? null,
      forum_name: details?.forumName ?? null,
      registered_until: details?.registeredUntil ?? null,
      details_seeders: details?.seeders ?? null,
      last_checked: details?.lastChecked ?? null,
      magnet_link: details?.magnetLink ?? null,
      torrent_file: details?.torrentFile ?? null,
      details_size: details?.size ?? null,
      author_name: details?.authorName ?? null,
      author_posts: details?.authorPosts ?? null,
      topic_title: details?.topicTitle ?? null,
      year: details?.year ?? null,
      author_first_name: details?.authorFirstName ?? null,
      author_last_name: details?.authorLastName ?? null,
      performer: details?.performer ?? null,
      series: details?.series ?? null,
      book_number: details?.bookNumber ?? null,
      genre: details?.genre ?? null,
      edition_type: details?.editionType ?? null,
      audio_codec: details?.audioCodec ?? null,
      bitrate: details?.bitrate ?? null,
      duration: details?.duration ?? null,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
