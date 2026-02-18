#!/usr/bin/env node

/**
 * Command-line interface for the standalone crawler
 */

import { main } from './main';
import { CrawlConfig } from './types';

function parseArgs(): CrawlConfig {
  const args = process.argv.slice(2);
  let pages = 1;
  let forumId = 2387; // Default forum ID for Russian fantasy audiobooks
  let concurrentRequests = 5;
  let retryAttempts = 3;
  let retryDelayMs = 1000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--pages' || arg === '-p') {
      if (nextArg && !nextArg.startsWith('-')) {
        pages = parseInt(nextArg, 10);
        if (isNaN(pages) || pages < 1) {
          console.error('Error: --pages must be a positive integer');
          process.exit(1);
        }
        i++; // Skip next arg
      } else {
        console.error('Error: --pages requires a numeric value');
        process.exit(1);
      }
    }

    if (arg === '--forum-id' || arg === '-f') {
      if (nextArg && !nextArg.startsWith('-')) {
        forumId = parseInt(nextArg, 10);
        if (isNaN(forumId) || forumId < 1) {
          console.error('Error: --forum-id must be a positive integer');
          process.exit(1);
        }
        i++;
      } else {
        console.error('Error: --forum-id requires a numeric value');
        process.exit(1);
      }
    }

    if (arg === '--concurrent' || arg === '-c') {
      if (nextArg && !nextArg.startsWith('-')) {
        concurrentRequests = parseInt(nextArg, 10);
        if (isNaN(concurrentRequests) || concurrentRequests < 1) {
          console.error('Error: --concurrent must be a positive integer');
          process.exit(1);
        }
        i++;
      } else {
        console.error('Error: --concurrent requires a numeric value');
        process.exit(1);
      }
    }

    if (arg === '--retry-attempts' || arg === '-r') {
      if (nextArg && !nextArg.startsWith('-')) {
        retryAttempts = parseInt(nextArg, 10);
        if (isNaN(retryAttempts) || retryAttempts < 0) {
          console.error('Error: --retry-attempts must be a non-negative integer');
          process.exit(1);
        }
        i++;
      } else {
        console.error('Error: --retry-attempts requires a numeric value');
        process.exit(1);
      }
    }

    if (arg === '--retry-delay' || arg === '-d') {
      if (nextArg && !nextArg.startsWith('-')) {
        retryDelayMs = parseInt(nextArg, 10);
        if (isNaN(retryDelayMs) || retryDelayMs < 0) {
          console.error('Error: --retry-delay must be a non-negative integer');
          process.exit(1);
        }
        i++;
      } else {
        console.error('Error: --retry-delay requires a numeric value');
        process.exit(1);
      }
    }
  }

  return {
    forumId,
    pages,
    concurrentRequests,
    retryAttempts,
    retryDelayMs
  };
}

function printHelp() {
  console.log(`
Standalone Rutracker Crawler
============================

Usage:
  node crawler/cli.ts [options]

Options:
  --pages, -p <number>        Number of forum pages to crawl (default: 1)
  --forum-id, -f <number>     Forum ID to crawl (default: 2387 - Russian fantasy audiobooks)
  --concurrent, -c <number>   Number of concurrent requests (default: 5)
  --retry-attempts, -r <number> Number of retry attempts for failed pages (default: 3)
  --retry-delay, -d <ms>      Delay between retries in milliseconds (default: 1000)
  --help, -h                  Show this help message

Examples:
  node crawler/cli.ts --pages 10
  node crawler/cli.ts -p 5 --concurrent 3 --retry-attempts 5
  `);
}

async function run() {
  try {
    const config = parseArgs();
    
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
    console.error('Crawler failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  run();
}

export { parseArgs, printHelp };