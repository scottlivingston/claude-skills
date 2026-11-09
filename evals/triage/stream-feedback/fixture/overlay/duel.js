// The duel screen: two videos side by side, the vote tally under them.

export function renderDuel(root, frame) {
  root.querySelector(".run-name").textContent = frame.runName;
  root.querySelector(".matchup").textContent = `${frame.left.title} vs ${frame.right.title}`;
  root.querySelector(".vote-count").textContent = `${frame.left.votes} : ${frame.right.votes}`;
  for (const side of ["left", "right"]) {
    const video = root.querySelector(`video.${side}`);
    if (video.src !== frame[side].src) video.src = frame[side].src;
    if (frame[side].playing && video.paused) video.play();
    if (!frame[side].playing && !video.paused) video.pause();
  }
}
