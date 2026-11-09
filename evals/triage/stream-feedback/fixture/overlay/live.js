// The Overlay's live connection: one WebSocket that streams run frames.

const REDIAL_MS = 2000;

export function follow(url, onFrame) {
  const ws = new WebSocket(url);
  ws.onmessage = (ev) => onFrame(JSON.parse(ev.data));
  // Redial only when the socket reports a close; there is no heartbeat or read timeout.
  ws.onclose = () => setTimeout(() => follow(url, onFrame), REDIAL_MS);
}
