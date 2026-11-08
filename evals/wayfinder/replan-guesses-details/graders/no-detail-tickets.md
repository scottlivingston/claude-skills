---
type: regex
target: files
match: not_contains
flags: i
pattern: 'risks/[^\n]*(bench|measur|throughput|perf|speed|reboot|restart|kernel|timing|devcontainer|qcow|overlay|default)|issues/[^\n]*(bench|measur|throughput|perf|speed|timing|compar|-vs-)'
---
