import { timingSafeEqual } from "node:crypto";

// Every client presents this key on connect; the server compares it in constant time.
export const SHARED_KEY = process.env.RAID_SHARED_KEY ?? "dev-key";

// Admits a connecting client when the key it presents matches SHARED_KEY.
export function admit(presented: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(SHARED_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}
