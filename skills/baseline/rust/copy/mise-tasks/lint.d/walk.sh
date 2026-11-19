# mise-tasks/lint.d/walk.sh — the file walk shared by the lint.d checks that
# scan the tree: find under $root, pruning vendor and archived (code the repo
# carries but does not write), target, dist, node_modules, .git and .claude
# (the last holds other branches' worktrees).
# Non-executable (644): sourced, never run. Needs $root set.

walk() {
  find "$root" \( -name vendor -o -name archived -o -name target -o -name dist -o -name node_modules -o -name .git \
    -o -name .claude \) -prune -o "$@"
}
