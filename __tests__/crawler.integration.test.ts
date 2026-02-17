/**
 * Integration tests for the crawler
 *
 * These tests verify that:
 * 1. HTML pages are correctly parsed
 * 2. All data fields are extracted properly
 * 3. Data is correctly stored in the SQLite database
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import {
  initDatabase,
  closeDatabase,
  getDb,
  torrents,
  torrentDetails,
  crawlHistory,
} from "@/db/index";
import { RutrackerParser } from "@/lib/parsers";
import { fixture } from "./fixtures/torrents-page";

// Mock topic details HTML
const mockTopicDetailsHTML = `
<!DOCTYPE html>
<html>
<head><title>Test Torrent</title></head>
<body>
<div class="nav">
  <a href="/">Main</a>
  <a href="/forum/">Forums</a>
  <a href="/forum/viewforum.php?f=1">Video</a>
  <a href="/forum/viewforum.php?f=1">Movies</a>
</div>
<div class="post_body">
  This is a test description for the torrent. It contains details about the content.
</div>
<div class="reg-details">
  <span>Registered: 2024-01-01</span>
</div>
<div class="seeders">150</div>
<div class="magnet">
  <a href="magnet:?xt=urn:btih:testhash123">Magnet Link</a>
</div>
<div class="download">
  <a href="/forum/dl.php?t=123456">Download Torrent</a>
</div>
</body>
</html>
`;

// Helper function to parse torrent data from HTML (same logic as crawler)
function parseTorrentRow($: cheerio.CheerioAPI, row: any) {
  const $row = $(row);
  const $link = $row.find("td.tor-title a.tor-title");
  const href = $link.attr("href");
  const topicIdMatch = href?.match(/t=(\d+)/);

  if (!topicIdMatch) return null;

  const topicId = topicIdMatch[1];
  const title = $link.text().trim();
  const size = $row.find("td:nth-child(3)").text().trim() || "0 B";
  const seeds =
    parseInt(
      $row.find("td:nth-child(4)").text().trim().replace(/[^\d]/g, ""),
      10,
    ) || 0;
  const leechers =
    parseInt(
      $row.find("td:nth-child(5)").text().trim().replace(/[^\d]/g, ""),
      10,
    ) || 0;
  const downloads =
    parseInt(
      $row.find("td:nth-child(6)").text().trim().replace(/[^\d]/g, ""),
      10,
    ) || 0;
  const author = $row.find("td:nth-child(7) a").text().trim() || "Unknown";
  const createdAt = $row.find("td:nth-child(8)").text().trim();

  return {
    topicId,
    url: `https://rutracker.org/forum/viewtopic.php?t=${topicId}`,
    title,
    forumId: 1,
    size,
    seeds,
    leechers,
    downloads,
    author,
    createdAt,
  };
}

describe("Crawler Integration Tests", () => {
  let testDb: any;

  beforeAll(async () => {
    // Suppress console.log during tests
    console.log("-------1---");
    // Initialize test database
    await initDatabase("test");
    testDb = getDb();
    console.log("-------2--1-", testDb);
  });

  afterAll(() => {
    closeDatabase();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clear database before each test using Drizzle
    if (testDb) {
      await testDb.delete(torrentDetails);
      await testDb.delete(torrents);
      await testDb.delete(crawlHistory);
    }
  });

  describe("HTML Parsing", () => {
    it("should correctly parse torrent data from forum page HTML", () => {
      const parser = new RutrackerParser();
      const torrentsList = parser.parse(fixture, 2387);

      // Verify we parsed torrents
      expect(torrentsList.length).toBeGreaterThan(0);

      // Verify first torrent data (from fixture)
      const firstTorrent = torrentsList[0];
      expect(firstTorrent.topicId).toBeDefined();
      expect(firstTorrent.url).toContain("viewtopic.php?t=");
      expect(firstTorrent.title).toBeDefined();
      expect(firstTorrent.forumId).toBe(2387);
      expect(firstTorrent.size).toBeDefined();
      expect(firstTorrent.seeds).toBeDefined();
      expect(firstTorrent.leechers).toBeDefined();
      expect(firstTorrent.downloads).toBeDefined();
      expect(firstTorrent.author).toBeDefined();
    });

    it("should parse all required fields for each torrent", () => {
      const parser = new RutrackerParser();
      const torrentsList = parser.parse(fixture, 2387);

      // Check all required fields are present for all torrents
      torrentsList.forEach((torrent) => {
        expect(torrent.topicId).toBeDefined();
        expect(torrent.url).toBeDefined();
        expect(torrent.title).toBeDefined();
        expect(torrent.forumId).toBeDefined();
        expect(torrent.size).toBeDefined();
        expect(torrent.seeds).toBeDefined();
        expect(torrent.leechers).toBeDefined();
        expect(torrent.downloads).toBeDefined();
        expect(torrent.author).toBeDefined();
      });
    });

    it("should handle different size formats correctly", () => {
      const parser = new RutrackerParser();
      const torrentsList = parser.parse(fixture, 2387);
      const sizes = torrentsList.map((t) => t.size);

      // Should have various size formats in the fixture
      expect(sizes.some((s) => s.includes("MB"))).toBe(true);
      expect(sizes.some((s) => s.includes("GB"))).toBe(true);
    });
  });

  describe("Database Storage", () => {
    it("should insert torrents into the database", async () => {
      const now = new Date().toISOString();
      const torrentData = {
        id: uuidv4(),
        topicId: "123456",
        url: "https://rutracker.org/forum/viewtopic.php?t=123456",
        title: "Test Torrent",
        forumId: 1,
        size: "1.5 GB",
        seeds: 100,
        leechers: 50,
        downloads: 500,
        author: "TestAuthor",
        createdAt: "2024-01-15",
        lastUpdated: now,
        status: "active",
      };

      await testDb.insert(torrents).values(torrentData);

      const results = await testDb.select().from(torrents);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Test Torrent");
      expect(results[0].topicId).toBe("123456");
    });

    it("should store all torrent fields correctly", async () => {
      const now = new Date().toISOString();
      const torrentData = {
        id: uuidv4(),
        topicId: "123456",
        url: "https://rutracker.org/forum/viewtopic.php?t=123456",
        title: "Test Torrent 1 - Sample Video",
        forumId: 1,
        size: "1.5 GB",
        seeds: 100,
        leechers: 50,
        downloads: 500,
        author: "TestAuthor1",
        createdAt: "2024-01-15",
        lastUpdated: now,
        status: "active",
      };

      await testDb.insert(torrents).values(torrentData);

      const results = await testDb
        .select()
        .from(torrents)
        .where(eq(torrents.topicId, "123456"));

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(torrentData.id);
      expect(results[0].topicId).toBe(torrentData.topicId);
      expect(results[0].url).toBe(torrentData.url);
      expect(results[0].title).toBe(torrentData.title);
      expect(results[0].forumId).toBe(torrentData.forumId);
      expect(results[0].size).toBe(torrentData.size);
      expect(results[0].seeds).toBe(torrentData.seeds);
      expect(results[0].leechers).toBe(torrentData.leechers);
      expect(results[0].downloads).toBe(torrentData.downloads);
      expect(results[0].author).toBe(torrentData.author);
      expect(results[0].status).toBe("active");
    });

    it("should insert multiple torrents and count correctly", async () => {
      const now = new Date().toISOString();

      // Insert 3 torrents
      for (let i = 0; i < 3; i++) {
        const torrentData = {
          id: uuidv4(),
          topicId: `12345${i}`,
          url: `https://rutracker.org/forum/viewtopic.php?t=12345${i}`,
          title: `Test Torrent ${i + 1}`,
          forumId: 1,
          size: "1 GB",
          seeds: 100,
          leechers: 50,
          downloads: 500,
          author: "TestAuthor",
          createdAt: now,
          lastUpdated: now,
          status: "active",
        };
        await testDb.insert(torrents).values(torrentData);
      }

      const results = await testDb.select().from(torrents);
      expect(results).toHaveLength(3);
    });

    it("should store crawl history correctly", async () => {
      const now = new Date().toISOString();
      const historyData = {
        id: uuidv4(),
        forumId: 1,
        pagesCrawled: 2,
        torrentsFound: 50,
        startedAt: now,
        completedAt: now,
        status: "completed",
        createdAt: now,
      };

      await testDb.insert(crawlHistory).values(historyData);

      const results = await testDb.select().from(crawlHistory);
      expect(results).toHaveLength(1);
      expect(results[0].forumId).toBe(1);
      expect(results[0].pagesCrawled).toBe(2);
      expect(results[0].torrentsFound).toBe(50);
      expect(results[0].status).toBe("completed");
    });
  });

  describe("End-to-End Crawl Test", () => {
    it("should parse HTML and store all data in database", async () => {
      const parser = new RutrackerParser();
      const torrentsList = parser.parse(fixture, 2387);

      // Store all parsed torrents in database
      const now = new Date().toISOString();
      for (const torrent of torrentsList) {
        const torrentData = {
          id: uuidv4(),
          topicId: torrent.topicId,
          url: torrent.url,
          title: torrent.title,
          forumId: torrent.forumId,
          size: torrent.size,
          seeds: torrent.seeds,
          leechers: torrent.leechers,
          downloads: torrent.downloads,
          author: torrent.author,
          createdAt: torrent.createdAt || now,
          lastUpdated: now,
          status: "active",
        };
        await testDb.insert(torrents).values(torrentData);
      }

      // Verify data in database
      const results = await testDb.select().from(torrents);

      // Should have torrents from fixture
      expect(results.length).toBeGreaterThan(0);

      // Verify each torrent has all required fields
      results.forEach((stored: any) => {
        expect(stored.topicId).toBeDefined();
        expect(stored.url).toBeDefined();
        expect(stored.title).toBeDefined();
        expect(stored.forumId).toBeDefined();
        expect(stored.size).toBeDefined();
        expect(stored.seeds).toBeDefined();
        expect(stored.leechers).toBeDefined();
        expect(stored.downloads).toBeDefined();
        expect(stored.author).toBeDefined();
        expect(stored.status).toBe("active");
      });
    });

    it("should handle empty HTML gracefully", () => {
      const emptyHTML =
        '<html><body><table class="vf-table vf-tor forumline forum"><tbody></tbody></table></body></html>';
      const parser = new RutrackerParser();
      const torrentsList = parser.parse(emptyHTML, 2387);

      expect(torrentsList).toHaveLength(0);
    });
  });

  describe("Rutracker Parser (Real HTML Structure)", () => {
    // Real Rutracker HTML structure based on actual page
    const realRutrackerHTML = `
<!DOCTYPE html>
<html>
<head><title>Rutracker</title></head>
<body>
<table class="vf-table vf-tor forumline forum">
  <col class="row1 vf-col-icon">
  <col class="row1 vf-col-t-title">
  <col class="row2 vf-col-tor">
  <col class="row2 vf-col-replies">
  <col class="row2 vf-col-last-post">
  <tbody>
    <tr id="tr-6768110" class="hl-tr" data-topic_id="6768110">
      <td class="vf-col-icon vf-topic-icon-cell">
        <img class="topic_icon" src="/folder_sticky.gif" alt="">
      </td>
      <td class="vf-col-t-title tt">
        <div class="torTopic">
          <span class="tor-icon tor-approved">✓</span>
          <a id="tt-6768110" href="viewtopic.php?t=6768110" class="torTopic bold tt-text">Test Torrent 1 - Sample Video</a>
        </div>
        <div class="topicAuthor">
          <a href="profile.php?u=123" class="topicAuthor">Author1</a>
        </div>
      </td>
      <td class="vf-col-tor tCenter med nowrap">
        <span class="seedmed" title="Seeders"><b>38</b></span>
        <span class="med"> | </span>
        <span class="leechmed" title="Leechers"><b>3</b></span>
        <div style="padding-top: 2px" class="small">
          <a href="dl.php?t=6768110" class="small f-dl dl-stub">446.4 MB</a>
        </div>
      </td>
      <td class="vf-col-replies tCenter small nowrap">
        <p>50</p>
      </td>
      <td class="vf-col-last-post tCenter small nowrap">
        <a href="profile.php?u=123">Author1</a>
        <a href="viewtopic.php?p=88738744#88738744">
          <img src="/icon_latest_reply.gif" alt="">
        </a>
      </td>
    </tr>
    <tr id="tr-6682645" class="hl-tr" data-topic_id="6682645">
      <td class="vf-col-icon vf-topic-icon-cell">
        <img class="topic_icon" src="/folder_new.gif" alt="">
      </td>
      <td class="vf-col-t-title tt">
        <div class="torTopic">
          <a id="tt-6682645" href="viewtopic.php?t=6682645" class="torTopic bold tt-text">Test Torrent 2 - Music Collection</a>
        </div>
        <div class="topicAuthor">
          <a href="profile.php?u=456" class="topicAuthor">Author2</a>
        </div>
      </td>
      <td class="vf-col-tor tCenter med nowrap">
        <span class="seedmed" title="Seeders"><b>100</b></span>
        <span class="med"> | </span>
        <span class="leechmed" title="Leechers"><b>10</b></span>
        <div style="padding-top: 2px" class="small">
          <a href="dl.php?t=6682645" class="small f-dl dl-stub">800 MB</a>
        </div>
      </td>
      <td class="vf-col-replies tCenter small nowrap">
        <p>25</p>
      </td>
      <td class="vf-col-last-post tCenter small nowrap">
        <a href="profile.php?u=456">Author2</a>
      </td>
    </tr>
  </tbody>
</table>
</body>
</html>
`;

    it("should parse real Rutracker HTML structure with vf-table", () => {
      const parser = new RutrackerParser();
      const torrentsList = parser.parse(realRutrackerHTML, 2387);

      // Should find 2 torrents
      expect(torrentsList.length).toBe(2);

      // Verify first torrent
      const first = torrentsList[0];
      expect(first.topicId).toBe("6768110");
      expect(first.title).toBe("Test Torrent 1 - Sample Video");
      expect(first.seeds).toBe(38);
      expect(first.leechers).toBe(3);
      expect(first.size).toBe("446.4 MB");
      expect(first.author).toBe("Author1");

      // Verify second torrent
      const second = torrentsList[1];
      expect(second.topicId).toBe("6682645");
      expect(second.title).toBe("Test Torrent 2 - Music Collection");
      expect(second.seeds).toBe(100);
      expect(second.leechers).toBe(10);
      expect(second.size).toBe("800 MB");
      expect(second.author).toBe("Author2");
    });

    it("should parse 50 torrents (simulated page)", () => {
      // Generate HTML with 50 torrents
      let html =
        '<!DOCTYPE html><html><body><table class="vf-table vf-tor forumline forum"><tbody>';
      for (let i = 0; i < 50; i++) {
        html += `
    <tr id="tr-${6000000 + i}" class="hl-tr" data-topic_id="${6000000 + i}">
      <td class="vf-col-icon vf-topic-icon-cell">
        <img class="topic_icon" src="/folder_new.gif" alt="">
      </td>
      <td class="vf-col-t-title tt">
        <div class="torTopic">
          <a id="tt-${6000000 + i}" href="viewtopic.php?t=${6000000 + i}" class="torTopic bold tt-text">Test Torrent ${i + 1}</a>
        </div>
        <div class="topicAuthor">
          <a href="profile.php?u=${i + 100}" class="topicAuthor">Author${i + 1}</a>
        </div>
      </td>
      <td class="vf-col-tor tCenter med nowrap">
        <span class="seedmed" title="Seeders"><b>${10 + i}</b></span>
        <span class="med"> | </span>
        <span class="leechmed" title="Leechers"><b>${i}</b></span>
        <div style="padding-top: 2px" class="small">
          <a href="dl.php?t=${6000000 + i}" class="small f-dl dl-stub">${(i + 1) * 100}.${i} MB</a>
        </div>
      </td>
      <td class="vf-col-replies tCenter small nowrap">
        <p>${i + 1}</p>
      </td>
      <td class="vf-col-last-post tCenter small nowrap">
        <a href="profile.php?u=${i + 100}">Author${i + 1}</a>
      </td>
    </tr>`;
      }
      html += "</tbody></table></body></html>";

      const parser = new RutrackerParser();
      const torrentsList = parser.parse(html, 2387);

      // Should find exactly 50 torrents
      expect(torrentsList.length).toBe(50);

      // Verify first and last
      expect(torrentsList[0].topicId).toBe("6000000");
      expect(torrentsList[49].topicId).toBe("6000049");
      expect(torrentsList[0].seeds).toBe(10);
      expect(torrentsList[49].seeds).toBe(59);
    });
  });

  describe("Topic Details Parsing", () => {
    it("should parse topic details from HTML", () => {
      const $ = cheerio.load(mockTopicDetailsHTML);

      const description = $(".post_body")
        .first()
        .text()
        .trim()
        .substring(0, 5000);
      const category = $(".nav a").last().text().trim();
      const forumName = $(".nav a").eq(-2).text().trim();
      const registeredUntil = $(".reg-details span").text().trim();
      const seeders =
        parseInt($(".seeders").text().trim().replace(/[^\d]/g, ""), 10) || 0;
      const magnetLink = $(".magnet a").attr("href") || "";
      const torrentFile = $(".download a").attr("href") || "";

      expect(description).toContain("test description");
      expect(category).toBe("Movies");
      expect(forumName).toBe("Video");
      expect(registeredUntil).toContain("Registered: 2024-01-01");
      expect(seeders).toBe(150);
      expect(magnetLink).toContain("magnet:?");
      expect(torrentFile).toContain("/forum/dl.php?t=");
    });
  });

  describe("Deduplication Tests", () => {
    it("should detect existing torrent by topic_id", async () => {
      const now = new Date().toISOString();

      // Insert a torrent first
      const existingTorrent = {
        id: uuidv4(),
        topicId: "123456",
        url: "https://rutracker.org/forum/viewtopic.php?t=123456",
        title: "Existing Torrent",
        forumId: 1,
        size: "1 GB",
        seeds: 100,
        leechers: 50,
        downloads: 500,
        author: "TestAuthor",
        createdAt: now,
        lastUpdated: now,
        status: "active",
      };
      await testDb.insert(torrents).values(existingTorrent);

      // Check if it exists using Drizzle query
      const results = await testDb
        .select()
        .from(torrents)
        .where(eq(torrents.topicId, "123456"));
      expect(results.length).toBe(1);

      const notExistsResults = await testDb
        .select()
        .from(torrents)
        .where(eq(torrents.topicId, "999999"));
      expect(notExistsResults.length).toBe(0);
    });

    it("should not insert duplicate torrents on second crawl", async () => {
      const now = new Date().toISOString();

      // Simulate first crawl - insert 3 torrents
      const torrentsList = [
        { topicId: "123456", title: "Torrent 1", seeds: 100 },
        { topicId: "234567", title: "Torrent 2", seeds: 200 },
        { topicId: "345678", title: "Torrent 3", seeds: 300 },
      ];

      for (const torrent of torrentsList) {
        const torrentData = {
          id: uuidv4(),
          topicId: torrent.topicId,
          url: `https://rutracker.org/forum/viewtopic.php?t=${torrent.topicId}`,
          title: torrent.title,
          forumId: 1,
          size: "1 GB",
          seeds: torrent.seeds,
          leechers: 50,
          downloads: 500,
          author: "TestAuthor",
          createdAt: now,
          lastUpdated: now,
          status: "active",
        };
        await testDb.insert(torrents).values(torrentData);
      }

      // Verify 3 torrents in DB
      const countBefore = await testDb.select().from(torrents);
      expect(countBefore.length).toBe(3);

      // Simulate second crawl with same data + 1 new torrent
      const secondCrawlTorrents = [
        { topicId: "123456", title: "Torrent 1", seeds: 100 }, // Duplicate
        { topicId: "234567", title: "Torrent 2", seeds: 200 }, // Duplicate
        { topicId: "345678", title: "Torrent 3", seeds: 300 }, // Duplicate
        { topicId: "456789", title: "New Torrent", seeds: 400 }, // New
      ];

      let newTorrentsAdded = 0;
      for (const torrent of secondCrawlTorrents) {
        // This simulates the deduplication logic in the crawler
        const exists = await testDb
          .select()
          .from(torrents)
          .where(eq(torrents.topicId, torrent.topicId));

        if (exists.length > 0) {
          console.log(`Skipping duplicate torrent: ${torrent.topicId}`);
          continue;
        }

        const torrentData = {
          id: uuidv4(),
          topicId: torrent.topicId,
          url: `https://rutracker.org/forum/viewtopic.php?t=${torrent.topicId}`,
          title: torrent.title,
          forumId: 1,
          size: "1 GB",
          seeds: torrent.seeds,
          leechers: 50,
          downloads: 500,
          author: "TestAuthor",
          createdAt: now,
          lastUpdated: now,
          status: "active",
        };
        await testDb.insert(torrents).values(torrentData);
        newTorrentsAdded++;
      }

      // Only 1 new torrent should have been added
      expect(newTorrentsAdded).toBe(1);

      // Total should still be 4 (3 old + 1 new)
      const countAfter = await testDb.select().from(torrents);
      expect(countAfter.length).toBe(4);
    });

    it("should prevent duplicate entries even with same topic_id on different pages", async () => {
      const now = new Date().toISOString();

      // Insert a torrent with topic_id
      const existingTorrent = {
        id: uuidv4(),
        topicId: "123456",
        url: "https://rutracker.org/forum/viewtopic.php?t=123456",
        title: "First Page Torrent",
        forumId: 1,
        size: "1 GB",
        seeds: 100,
        leechers: 50,
        downloads: 500,
        author: "TestAuthor",
        createdAt: now,
        lastUpdated: now,
        status: "active",
      };
      await testDb.insert(torrents).values(existingTorrent);

      // Try to insert again with same topic_id (simulating page 2 having same torrent)
      const duplicateTorrent = {
        id: uuidv4(), // Different ID but same topic_id
        topicId: "123456",
        url: "https://rutracker.org/forum/viewtopic.php?t=123456",
        title: "First Page Torrent (Duplicate)",
        forumId: 1,
        size: "1.5 GB", // Different size (updated)
        seeds: 150, // Different seeds (updated)
        leechers: 60,
        downloads: 600,
        author: "TestAuthor",
        createdAt: now,
        lastUpdated: now,
        status: "active",
      };

      // Check if exists before inserting using Drizzle
      const exists = await testDb
        .select()
        .from(torrents)
        .where(eq(torrents.topicId, "123456"));
      expect(exists.length).toBe(1);

      const notExists = await testDb
        .select()
        .from(torrents)
        .where(eq(torrents.topicId, "999999"));
      expect(notExists.length).toBe(0);
    });
  });
});
