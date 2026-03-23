import { runDailyCrawlJob, type DailyCrawlJobConfig } from "./daily-job";

export interface DailySchedulerHandle {
  stop: () => void;
}

function millisecondsUntilNextUtcMidnight(now: Date): number {
  const nextRun = new Date(now);
  nextRun.setUTCHours(24, 0, 0, 0);
  return nextRun.getTime() - now.getTime();
}

export function startDailyCrawlScheduler(
  overrides: Partial<DailyCrawlJobConfig> = {},
): DailySchedulerHandle {
  let timeoutId: NodeJS.Timeout | null = null;
  let stopped = false;
  let running = false;

  const scheduleNextRun = () => {
    if (stopped) {
      return;
    }

    const delayMs = millisecondsUntilNextUtcMidnight(new Date());
    if(delayMs > 1000 * 60){
      runDailyCrawlJob(overrides);
    }
    timeoutId = setTimeout(async () => {
      if (running) {
        scheduleNextRun();
        return;
      }

      running = true;
      try {
        await runDailyCrawlJob(overrides);
      } catch (error) {
        console.error("Scheduled daily crawl job failed:", error);
      } finally {
        running = false;
        scheduleNextRun();
      }
    }, delayMs);

    console.log(
      `Daily crawl scheduler armed. Next run in ${Math.round(delayMs / 1000)}s at 00:00 UTC.`,
    );
  };

  scheduleNextRun();

  return {
    stop: () => {
      stopped = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}

export function getMillisecondsUntilNextUtcMidnight(now: Date = new Date()): number {
  return millisecondsUntilNextUtcMidnight(now);
}
