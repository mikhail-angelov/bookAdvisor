import { promises as fs } from "fs";
import path from "path";

export interface Session {
  cookieHeader: string; // "name=value; name2=value2"
  userAgent: string;
  createdAt: number; // epoch ms
}

interface StoreFile {
  [domain: string]: Session;
}

const DEFAULT_STORE_PATH = path.resolve(
  process.cwd(),
  "data",
  "flare-sessions.json",
);

// How long we trust a solved cf_clearance session before forcing a re-solve.
// cf_clearance usually lives for hours; keep this conservative.
export const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export class SessionStore {
  constructor(private filePath: string = DEFAULT_STORE_PATH) {}

  private async readAll(): Promise<StoreFile> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as StoreFile;
    } catch {
      return {};
    }
  }

  private async writeAll(data: StoreFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async get(domain: string): Promise<Session | null> {
    const all = await this.readAll();
    const session = all[domain];
    if (!session) return null;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) return null;
    return session;
  }

  async set(domain: string, session: Session): Promise<void> {
    const all = await this.readAll();
    all[domain] = session;
    await this.writeAll(all);
  }

  async invalidate(domain: string): Promise<void> {
    const all = await this.readAll();
    delete all[domain];
    await this.writeAll(all);
  }
}
