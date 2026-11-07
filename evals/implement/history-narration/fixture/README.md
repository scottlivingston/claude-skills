# Search box

A type-ahead search box for the product catalogue.

## How it works

Every keystroke goes to `onQueryInput` in `src/search.ts`. Input is normalized
(trimmed, lowercased), and queries shorter than two characters clear the list
without hitting the server. Longer queries are debounced by 300ms, so a burst
of typing sends one request. Finished results are published through
`src/results.ts`, which any component can `subscribe` to.

`cancelSearch` drops a pending query and clears the list; call it when the box
closes.
