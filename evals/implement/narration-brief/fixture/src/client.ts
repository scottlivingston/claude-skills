import { SHARED_KEY } from "./auth";

const MAX_ATTEMPTS = 5;

// Opens the game connection, presenting the shared key. Retries with doubling
// backoff up to MAX_ATTEMPTS — it no longer retries forever, which hammered the
// server during the outage in #41.
export async function connect(
  url: string,
  open: (url: string, credential: string) => Promise<WebSocket>,
): Promise<WebSocket> {
  let delay = 250;
  for (let attempt = 1; ; attempt++) {
    try {
      return await open(url, SHARED_KEY);
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}
