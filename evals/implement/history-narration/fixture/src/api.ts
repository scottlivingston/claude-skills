export async function fetchResults(query: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(`/search?q=${encodeURIComponent(query)}`, { signal });
  return res.json();
}
