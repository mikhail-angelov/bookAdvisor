import nodemailer from "nodemailer";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { main } from "./main";
import { processCrawls } from "./parser-service";
import {
  getAppDbAsync,
  getCrawlDbAsync,
  book,
  crawl,
  crawlHistory,
} from "../db/index";
import { CrawlStatus, CrawlType, type CrawlConfig } from "./types";

export interface DailyCrawlJobConfig extends CrawlConfig {
  recipientEmail: string;
}

export interface DailyCrawlJobSummary {
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  forumId: number;
  pages: number;
  recipientEmail: string;
  crawlHistoryId: string | null;
  forumPagesProcessed: number;
  torrentLinksFound: number;
  detailPagesCompleted: number;
  detailPagesFailed: number;
  booksUpdated: number;
  totalBooksInDb: number;
  errorMessage?: string;
}

const DEFAULT_DAILY_JOB_CONFIG: DailyCrawlJobConfig = {
  forumId: 2387,
  pages: 3,
  concurrentRequests: 3,
  retryAttempts: 3,
  retryDelayMs: 1000,
  recipientEmail: process.env.ADMIN_EMAIL ?? "",
};

function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

async function collectSummary(
  startedAt: Date,
  config: DailyCrawlJobConfig,
  status: DailyCrawlJobSummary["status"],
  errorMessage?: string,
): Promise<DailyCrawlJobSummary> {
  const crawlDb = await getCrawlDbAsync();
  const appDb = await getAppDbAsync();
  const startedAtIso = startedAt.toISOString();

  const latestHistory = await crawlDb
    .select()
    .from(crawlHistory)
    .where(gte(crawlHistory.startedAt, startedAtIso))
    .orderBy(desc(crawlHistory.startedAt))
    .limit(1);

  const [booksUpdatedResult] = await appDb
    .select({ count: count() })
    .from(book)
    .where(gte(book.updatedAt, startedAtIso));

  const [totalBooksResult] = await appDb.select({ count: count() }).from(book);

  const [detailCompletedResult] = await crawlDb
    .select({ count: count() })
    .from(crawl)
    .where(
      and(
        eq(crawl.status, CrawlStatus.COMPLETED),
        eq(crawl.type, CrawlType.TORRENT_DETAILS),
        gte(crawl.createdAt, startedAtIso),
      ),
    );

  const [detailFailedResult] = await crawlDb
    .select({ count: count() })
    .from(crawl)
    .where(
      and(
        eq(crawl.status, CrawlStatus.ERROR),
        eq(crawl.type, CrawlType.TORRENT_DETAILS),
        gte(crawl.createdAt, startedAtIso),
      ),
    );

  const completedAt = new Date();

  return {
    status,
    startedAt: startedAtIso,
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    forumId: config.forumId,
    pages: config.pages,
    recipientEmail: config.recipientEmail,
    crawlHistoryId: latestHistory[0]?.id ?? null,
    forumPagesProcessed: latestHistory[0]?.pagesCrawled ?? 0,
    torrentLinksFound: latestHistory[0]?.torrentsFound ?? 0,
    detailPagesCompleted: detailCompletedResult?.count ?? 0,
    detailPagesFailed: detailFailedResult?.count ?? 0,
    booksUpdated: booksUpdatedResult?.count ?? 0,
    totalBooksInDb: totalBooksResult?.count ?? 0,
    errorMessage,
  };
}

async function sendDailySummaryEmail(
  summary: DailyCrawlJobSummary,
): Promise<void> {
  if (!process.env.POST_SERVICE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("POST_SERVICE_URL must be configured in production.");
    }

    console.log("--- DAILY CRAWL SUMMARY EMAIL ---");
    console.log(`To: ${summary.recipientEmail}`);
    console.log(buildSummaryText(summary));
    console.log("---------------------------------");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.POST_SERVICE_URL,
    port: parseInt(process.env.POST_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.POST_USER,
      pass: process.env.POST_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Book Advisor" <${process.env.SMTP_FROM || "no-reply@js2go.ru"}>`,
    to: summary.recipientEmail,
    subject: `Book Advisor daily crawl ${summary.status} (${summary.startedAt.slice(0, 10)})`,
    text: buildSummaryText(summary),
    html: buildSummaryHtml(summary),
  });
}

function buildSummaryText(summary: DailyCrawlJobSummary): string {
  return [
    `Daily crawl job ${summary.status}.`,
    `Started at: ${summary.startedAt}`,
    `Completed at: ${summary.completedAt}`,
    `Duration: ${formatDuration(summary.durationMs)}`,
    `Forum ID: ${summary.forumId}`,
    `Forum pages requested: ${summary.pages}`,
    `Forum pages processed: ${summary.forumPagesProcessed}`,
    `Torrent links found: ${summary.torrentLinksFound}`,
    `Detail pages completed: ${summary.detailPagesCompleted}`,
    `Detail pages failed: ${summary.detailPagesFailed}`,
    `Books updated: ${summary.booksUpdated}`,
    `Total books in DB: ${summary.totalBooksInDb}`,
    ...(summary.errorMessage ? [`Error: ${summary.errorMessage}`] : []),
  ].join("\n");
}

function buildSummaryHtml(summary: DailyCrawlJobSummary): string {
  return `
    <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
      <h2 style="margin-top: 0;">Book Advisor daily crawl summary</h2>
      <p>The scheduled crawl job finished with status: <strong>${summary.status}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr><td style="padding: 6px 0; font-weight: bold;">Started at</td><td>${summary.startedAt}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Completed at</td><td>${summary.completedAt}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Duration</td><td>${formatDuration(summary.durationMs)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Forum ID</td><td>${summary.forumId}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Forum pages requested</td><td>${summary.pages}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Forum pages processed</td><td>${summary.forumPagesProcessed}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Torrent links found</td><td>${summary.torrentLinksFound}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Detail pages completed</td><td>${summary.detailPagesCompleted}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Detail pages failed</td><td>${summary.detailPagesFailed}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Books updated</td><td>${summary.booksUpdated}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Total books in DB</td><td>${summary.totalBooksInDb}</td></tr>
          ${summary.errorMessage ? `<tr><td style="padding: 6px 0; font-weight: bold;">Error</td><td>${summary.errorMessage}</td></tr>` : ""}
        </tbody>
      </table>
    </div>
  `;
}

export async function runDailyCrawlJob(
  overrides: Partial<DailyCrawlJobConfig> = {},
): Promise<DailyCrawlJobSummary> {
  const config: DailyCrawlJobConfig = {
    ...DEFAULT_DAILY_JOB_CONFIG,
    ...overrides,
  };

  const startedAt = new Date();

  try {
    await main(config);
    await processCrawls(false, undefined, startedAt.toISOString());
    const summary = await collectSummary(startedAt, config, "completed");
    await sendDailySummaryEmail(summary);
    return summary;
  } catch (error: any) {
    const summary = await collectSummary(
      startedAt,
      config,
      "failed",
      error instanceof Error ? error.message : String(error),
    );

    try {
      await sendDailySummaryEmail(summary);
    } catch (emailError) {
      console.error("Failed to send daily crawl failure summary:", emailError);
    }

    console.error("Daily crawl job failed:", error);
    throw error;
  }
}
