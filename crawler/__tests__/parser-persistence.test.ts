import { eq } from "drizzle-orm";
import { RutrackerParser, RutrackerDetailsParser } from "../parsers";
import { updateBooks } from "../repository";
import { fixture as forumHtml2 } from "./fixtures/torrents-page2";
import { fixture as detailsHtml6 } from "./fixtures/torrent-details6";
import { initDatabase, closeDatabase, getAppDbAsync, book } from "../../db/index";

describe("Parser persistence", () => {
  beforeAll(async () => {
    await initDatabase("test");
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    const appDb = await getAppDbAsync();
    await appDb.delete(book);
  });

  it("persists list metrics from the forum page after detail parsing updates the same book", async () => {
    const forumParser = new RutrackerParser();
    const detailParser = new RutrackerDetailsParser();

    const forumBooks = forumParser.parse(forumHtml2, 2387);
    const forumBook = forumBooks.find((entry) => entry.externalId === 6831914);

    expect(forumBook).toBeDefined();

    await updateBooks([forumBook!]);

    const detailBook = detailParser.parse(detailsHtml6, "6831914");
    await updateBooks([detailBook]);

    const appDb = await getAppDbAsync();
    const persistedBook = await appDb
      .select()
      .from(book)
      .where(eq(book.url, "https://rutracker.org/forum/viewtopic.php?t=6831914"))
      .get();

    expect(persistedBook).toBeDefined();
    expect(persistedBook?.externalId).toBe(6831914);
    expect(persistedBook?.size).toBe("411 MB");
    expect(persistedBook?.seeds).toBe(191);
    expect(persistedBook?.leechers).toBe(13);
    expect(persistedBook?.downloads).toBe(914);
    expect(persistedBook?.commentsCount).toBe(6);
    expect(persistedBook?.lastCommentDate).toBe("2026-03-19 07:21");
  });
});
