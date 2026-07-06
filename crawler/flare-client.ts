/**
 * Minimal client for a self-hosted FlareSolverr instance.
 * FlareSolverr docs: https://github.com/FlareSolverr/FlareSolverr
 */

export interface FlareSolveResult {
  html: string;
  cookieHeader: string;
  userAgent: string;
  status: number;
}

interface FlareSolverrCookie {
  name: string;
  value: string;
}

interface FlareSolverrResponse {
  status: "ok" | "error";
  message?: string;
  solution?: {
    url: string;
    status: number;
    response: string;
    cookies: FlareSolverrCookie[];
    userAgent: string;
  };
}

export class FlareClient {
  constructor(
    private endpoint: string =
      process.env.FLARESOLVERR_URL || "http://localhost:8191/v1",
    private timeoutMs: number = 60_000,
  ) {}

  async solve(url: string, session?: string): Promise<FlareSolveResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: "request.get",
          url,
          maxTimeout: this.timeoutMs,
          session,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(
          `FlareSolverr HTTP error: ${res.status} ${res.statusText}`,
        );
      }

      const data = (await res.json()) as FlareSolverrResponse;

      if (data.status !== "ok" || !data.solution) {
        throw new Error(
          `FlareSolverr failed to solve challenge: ${data.message || "unknown error"}`,
        );
      }

      const cookieHeader = data.solution.cookies
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      return {
        html: data.solution.response,
        cookieHeader,
        userAgent: data.solution.userAgent,
        status: data.solution.status,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
