type Listener = (query: string, results: string[]) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Pushes a finished query's results to every listener. Requests are debounced
// upstream in search.ts, so at most one is in flight and results always arrive
// in query order; listeners don't need to check for stale responses.
export function publishResults(query: string, results: string[]) {
  for (const listener of listeners) listener(query, results);
}

export function clearResults() {
  for (const listener of listeners) listener("", []);
}
