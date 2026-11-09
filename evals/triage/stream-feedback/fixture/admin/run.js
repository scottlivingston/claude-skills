// Run page: the streamer's controls for a bracket run.

/** Vote length a new run starts with, in seconds. */
export const DEFAULT_VOTE_SECS = 20;

export function voteSecs(field) {
  const n = Number.parseInt(field, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_VOTE_SECS;
}

export function startVote(run, field) {
  run.send({ type: "vote-open", secs: voteSecs(field) });
}
