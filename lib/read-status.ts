export const READ_STATUSES = [
  "want_to_read",
  "reading",
  "read",
  "dropped",
] as const;

export type ReadStatus = (typeof READ_STATUSES)[number];

export const DEFAULT_READ_STATUS: ReadStatus = "want_to_read";

export function isReadStatus(value: unknown): value is ReadStatus {
  return typeof value === "string" && READ_STATUSES.includes(value as ReadStatus);
}
