---
type: regex
target: { source: file, path: src/auth.ts }
pattern: 'export function (verifyToken|mintToken)[\s\S]*export function (verifyToken|mintToken)'
---
