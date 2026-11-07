---
type: regex
target: { source: file, path: src/auth.ts }
match: not_contains
flags: i
pattern: 'shared[ _-]?key|SHARED_KEY|no longer|previously|formerly|used to|the old|\bold (key|secret|scheme)|(instead of|rather than) (a |the |one )?(shared|single|common)|replac(es|ed|ing)\b|#[0-9]+|ticket'
---
