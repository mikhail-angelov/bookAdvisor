#!/usr/bin/env node

/**
 * Command-line interface for the standalone crawler
 */

import { main } from './main';
import { processCrawls } from './parser-service';
import { runDailyCrawlJob } from './daily-job';
import { CrawlConfig } from './types';

type Command = 'crawl' | 'parse' | 'daily';

interface ParsedArgs {
  command: Command;
  config: CrawlConfig;
  forceReload: boolean;
  recipientEmail?: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let command: Command = 'crawl';
  let forceReload = false;
  let pages = 1;
  let forumId = 2387;
  let concurrentRequests = 5;
  let retryAttempts = 3;
  let retryDelayMs = 1000;
  let recipientEmail: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === 'parse') { command = 'parse'; continue; }
    if (arg === 'daily') { command = 'daily'; continue; }
    if (arg === '--force') { forceReload = true; continue; }
    if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }

    const next = args[i + 1];
    const requiresNextNumber = (flag: string) => {
      if (!next || next.startsWith('-')) {
        console.error(`Error: ${flag} requires a numeric value`);
        process.exit(1);
      }
      i++;
      return parseInt(next, 10);
    };

    const requiresNextValue = (flag: string) => {
      if (!next || next.startsWith('-')) {
        console.error(`Error: ${flag} requires a value`);
        process.exit(1);
      }
      i++;
      return next;
    };

    if (arg === '--pages' || arg === '-p') {
      pages = requiresNextNumber('--pages');
      if (isNaN(pages) || pages < 1) { console.error('Error: --pages must be a positive integer'); process.exit(1); }
    } else if (arg === '--forum-id' || arg === '-f') {
      forumId = requiresNextNumber('--forum-id');
      if (isNaN(forumId) || forumId < 1) { console.error('Error: --forum-id must be a positive integer'); process.exit(1); }
    } else if (arg === '--concurrent' || arg === '-c') {
      concurrentRequests = requiresNextNumber('--concurrent');
      if (isNaN(concurrentRequests) || concurrentRequests < 1) { console.error('Error: --concurrent must be a positive integer'); process.exit(1); }
    } else if (arg === '--retry-attempts' || arg === '-r') {
      retryAttempts = requiresNextNumber('--retry-attempts');
      if (isNaN(retryAttempts) || retryAttempts < 0) { console.error('Error: --retry-attempts must be a non-negative integer'); process.exit(1); }
    } else if (arg === '--retry-delay' || arg === '-d') {
      retryDelayMs = requiresNextNumber('--retry-delay');
      if (isNaN(retryDelayMs) || retryDelayMs < 0) { console.error('Error: --retry-delay must be a non-negative integer'); process.exit(1); }
    } else if (arg === '--email' || arg === '-e') {
      recipientEmail = requiresNextValue('--email');
    }
  }

  return {
    command,
    forceReload,
    recipientEmail,
    config: { forumId, pages, concurrentRequests, retryAttempts, retryDelayMs },
  };
}

function printHelp() {
  console.log(`
Standalone Rutracker Crawler
============================

Usage:
  npm run crawl -- [command] [options]

Commands:
  crawl (default)               Download new pages from Rutracker
  parse                         Process already downloaded pages and fill books table
  daily                         Run scheduled daily flow: crawl, parse, and email summary

Options:
  --pages, -p <number>          Number of forum pages to crawl (default: 1)
  --forum-id, -f <number>       Forum ID to crawl (default: 2387)
  --concurrent, -c <number>     Number of concurrent requests (default: 5)
  --retry-attempts, -r <number> Number of retry attempts for failed pages (default: 3)
  --retry-delay, -d <ms>        Delay between retries in milliseconds (default: 1000)
  --email, -e <address>         Summary recipient for daily command
  --force                       Force reload already processed records (parse command only)
  --help, -h                    Show this help message

Examples:
  npm run crawl -- --pages 10
  npm run crawl -- parse
  npm run crawl -- parse --force
  npm run crawl -- daily
  npm run crawl -- daily --pages 3 --email test@example.com
  `);
}

async function run() {
  const { command, config, forceReload, recipientEmail } = parseArgs();

  try {
    if (command === 'parse') {
      console.log(`Starting parser (force: ${forceReload})...`);
      await processCrawls(forceReload);
      console.log('Parser completed successfully!');
      return;
    }

    if (command === 'daily') {
      console.log('Starting daily crawl job with configuration:');
      console.log(`  Forum ID: ${config.forumId}`);
      console.log(`  Pages to crawl: ${config.pages}`);
      console.log(`  Concurrent requests: ${config.concurrentRequests}`);
      console.log(`  Retry attempts: ${config.retryAttempts}`);
      console.log(`  Retry delay: ${config.retryDelayMs}ms`);
      console.log(`  Summary email: ${recipientEmail || 'test@example.com'}`);
      console.log('---');

      const summary = await runDailyCrawlJob({
        ...config,
        ...(recipientEmail ? { recipientEmail } : {}),
      });

      console.log('Daily crawl job completed successfully!');
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log('Starting crawler with configuration:');
    console.log(`  Forum ID: ${config.forumId}`);
    console.log(`  Pages to crawl: ${config.pages}`);
    console.log(`  Concurrent requests: ${config.concurrentRequests}`);
    console.log(`  Retry attempts: ${config.retryAttempts}`);
    console.log(`  Retry delay: ${config.retryDelayMs}ms`);
    console.log('---');

    await main(config);
    console.log('Crawler completed successfully!');
  } catch (error: any) {
    console.error('Failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

export { parseArgs, printHelp };
