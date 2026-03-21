import nodemailer from "nodemailer";
import { runDailyCrawlJob } from "../daily-job";
import { fetchUrl } from "../fetcher";
import { fixture as forumFixture } from "./fixtures/torrents-page";
import { fixture as detailsFixture } from "./fixtures/torrent-details";
import {
  initDatabase,
  closeDatabase,
  getAppDbAsync,
  getCrawlDbAsync,
  book,
  crawl,
  crawlHistory,
} from "../../db/index";

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "daily-summary-1" });

jest.mock("../fetcher", () => ({
  fetchUrl: jest.fn().mockImplementation((url: string) => {
    if (url.includes("viewforum.php")) {
      return Promise.resolve({
        url,
        html: forumFixture,
        status: 200,
        contentType: "text/html; charset=windows-1251",
        encoding: "windows-1251",
      });
    }

    if (url.includes("viewtopic.php")) {
      return Promise.resolve({
        url,
        html: detailsFixture,
        status: 200,
        contentType: "text/html; charset=windows-1251",
        encoding: "windows-1251",
      });
    }

    return Promise.resolve({
      url,
      html: "",
      status: 404,
      error: "Not found",
    });
  }),
}));

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

const mockFetchUrl = fetchUrl as jest.MockedFunction<typeof fetchUrl>;
const mockCreateTransport = nodemailer.createTransport as jest.MockedFunction<
  typeof nodemailer.createTransport
>;

describe("Daily crawl job", () => {
  beforeAll(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.POST_SERVICE_URL = "smtp.example.com";
    process.env.POST_PORT = "587";
    process.env.POST_USER = "test-user";
    process.env.POST_PASS = "test-pass";
    process.env.SMTP_FROM = "robot@example.com";
    await initDatabase("test");
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    const crawlDb = await getCrawlDbAsync();
    await crawlDb.delete(crawl);
    await crawlDb.delete(crawlHistory);

    const appDb = await getAppDbAsync();
    await appDb.delete(book);

    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: "daily-summary-1" });
  });

  it("runs crawl, parses forum and detail pages, updates the DB, and emails a summary", async () => {
    const summary = await runDailyCrawlJob({
      forumId: 2387,
      pages: 3,
      concurrentRequests: 2,
      retryAttempts: 0,
      retryDelayMs: 0,
      recipientEmail: "test@example.com",
    });

    const crawlDb = await getCrawlDbAsync();
    const appDb = await getAppDbAsync();

    const historyRecords = await crawlDb.select().from(crawlHistory);
    const books = await appDb.select().from(book);

    expect(historyRecords).toHaveLength(1);
    expect(historyRecords[0].status).toBe("completed");
    expect(historyRecords[0].pagesCrawled).toBe(3);
    expect(historyRecords[0].torrentsFound).toBe(100);

    expect(books.length).toBeGreaterThan(0);

    const parsedBook = books.find((entry) => entry.url?.includes("viewtopic.php?t=6737707"));
    expect(parsedBook).toBeDefined();
    expect(parsedBook?.downloads).toBeGreaterThan(0);
    expect(parsedBook?.commentsCount).toBeGreaterThan(0);
    expect(parsedBook?.performer).toBe("CHUGA");
    expect(parsedBook?.genre).toBe("Боевое фэнтези");

    expect(summary.pages).toBe(3);
    expect(summary.status).toBe("completed");
    expect(summary.forumPagesProcessed).toBe(3);
    expect(summary.detailPagesCompleted).toBeGreaterThan(0);
    expect(summary.booksUpdated).toBeGreaterThan(0);
    expect(summary.recipientEmail).toBe("test@example.com");

    expect(mockCreateTransport).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: expect.stringContaining("Book Advisor daily crawl completed"),
      }),
    );

    const forumCalls = mockFetchUrl.mock.calls.filter(([url]) => url.includes("viewforum.php"));
    expect(forumCalls).toHaveLength(3);
  });
});
