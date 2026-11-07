---
type: regex
target: { source: file, path: src/results.ts }
match: not_contains
flags: i
pattern: 'debounc|300\s*ms|DEBOUNCE|no longer|previously|formerly|used to|the old|(instead of|rather than) (the |a )?(debounc|wait|delay|timer)|replac(es|ed|ing)\b|now (sends|fires|aborts|cancels)'
---
