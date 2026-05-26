/*
  video.js — the motivational video screen.

  HOW IT WORKS
    1. Pick a random video from the playlist (mix of local + remote).
    2. Auto-play it (muted, because iOS blocks unmuted autoplay).
    3. Hide the Skip button until MIN_WATCH_SECONDS have passed.
    4. When the video ends OR Skip is pressed, show the "I'm ready" overlay.
    5. Pressing "I'm ready" calls onDone() so app.js can switch screens.
*/

// =====================================================================
// CHANGE THIS to control how long you must watch before "Skip" appears.
// Set to 0 to make Skip available immediately.
// Default: 15 seconds.
// =====================================================================
const MIN_WATCH_SECONDS = 15;

/*
  PLAYLIST — mix and match local files and remote URLs.

  Local files: drop .mp4 files into the /videos folder next to index.html,
  then add their relative path here, e.g. 'videos/my-motivation.mp4'.

  Remote URLs: any direct .mp4 link works. The two examples below are
  short royalty-free clips from Google's public sample-videos bucket,
  used here only so the screen has something to play out of the box —
  replace them with your own picks.
*/
const PLAYLIST = [
  // Example remote clips (replace whenever you like):
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',

  // Add your own local files like this once you put them in /videos:
  // 'videos/motivation-1.mp4',
  // 'videos/motivation-2.mp4',
];

export function initVideoScreen(onDone) {
  const video = document.getElementById('motivation-video');
  const skipBtn = document.getElementById('skip-btn');
  const readyOverlay = document.getElementById('ready-overlay');
  const readyBtn = document.getElementById('ready-btn');
  const noVideo = document.getElementById('no-video');
  const noVideoBtn = document.getElementById('no-video-continue');

  // If the playlist is empty, show a friendly fallback and a Continue button.
  if (PLAYLIST.length === 0) {
    noVideo.classList.remove('hidden');
    noVideoBtn.addEventListener('click', onDone);
    return;
  }

  // Pick a random entry. Math.random() * length floored gives 0..length-1.
  const src = PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)];
  video.src = src;

  // iOS Safari blocks autoplay UNLESS the video is muted + playsinline.
  // We accept muted autoplay; the user can unmute via the native controls
  // if we choose to show them (we don't, to keep it distraction-free).
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  // Try to play. If the browser rejects (rare with muted+playsinline),
  // we just show the "I'm ready" overlay so the user isn't stuck.
  video.play().catch(() => {
    readyOverlay.classList.remove('hidden');
  });

  // Show the Skip button after MIN_WATCH_SECONDS.
  // If MIN_WATCH_SECONDS is 0, show it immediately.
  if (MIN_WATCH_SECONDS <= 0) {
    skipBtn.classList.remove('hidden');
  } else {
    // setTimeout fires once after the delay. We use it instead of polling
    // video.currentTime because the user might pause; using wall-clock
    // time keeps the UX predictable.
    setTimeout(() => skipBtn.classList.remove('hidden'), MIN_WATCH_SECONDS * 1000);
  }

  // When the video naturally ends, show the "I'm ready" overlay.
  video.addEventListener('ended', () => {
    readyOverlay.classList.remove('hidden');
  });

  // Skip button: jump to the ready overlay (don't skip straight to tracker —
  // a brief moment to acknowledge intent feels nicer).
  skipBtn.addEventListener('click', () => {
    video.pause();
    readyOverlay.classList.remove('hidden');
  });

  // "I'm ready" hands control back to app.js, which swaps screens.
  readyBtn.addEventListener('click', () => {
    video.pause();
    onDone();
  });
}
