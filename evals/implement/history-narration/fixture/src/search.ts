import { fetchResults } from "./api";
import { publishResults, clearResults } from "./results";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

let timer: ReturnType<typeof setTimeout> | undefined;

// Lowercases and trims the raw input so "Foo " and "foo" hit the same cache entry.
export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

// Called on every keystroke. Waits DEBOUNCE_MS after the last keystroke before
// querying, so fast typing sends one request instead of one per key. Queries
// shorter than MIN_QUERY_LENGTH clear the results without a request.
export function onQueryInput(raw: string) {
  const query = normalizeQuery(raw);
  clearTimeout(timer);
  if (query.length < MIN_QUERY_LENGTH) {
    clearResults();
    return;
  }
  timer = setTimeout(async () => {
    publishResults(query, await fetchResults(query));
  }, DEBOUNCE_MS);
}

// Cancels any pending debounced query, e.g. when the search box is closed.
export function cancelSearch() {
  clearTimeout(timer);
  clearResults();
}

// Wraps each occurrence of the query in <mark> for the results list.
export function highlight(text: string, query: string): string {
  if (!query) return text;
  return text.split(query).join(`<mark>${query}</mark>`);
}
