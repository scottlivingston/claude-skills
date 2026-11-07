// Asks the server's queue for this viewer's connect token.
export async function fetchToken(viewerId: string): Promise<string> {
  const res = await fetch(`/queue/token?viewer=${encodeURIComponent(viewerId)}`);
  return (await res.json()).token;
}
