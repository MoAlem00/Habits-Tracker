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
  'videos/video.mp4',

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

  // playsinline lets the video stay embedded (no fullscreen takeover on iOS).
  video.playsInline = true;
  video.autoplay = true;

  // ----- Sound strategy --------------------------------------------------
  // iOS Safari blocks UNMUTED autoplay unless the user has already
  // interacted with the page in this session. So:
  //   1. Try unmuted first — works on Android/desktop and on iOS after
  //      the first run (Safari remembers).
  //   2. If iOS rejects, fall back to muted + show a "Tap for sound"
  //      button. The user's tap counts as interaction, so we can then
  //      unmute without restarting the video.
  video.muted = false;

  const unmuteBtn = document.getElementById('unmute-btn');

  video.play()
    .then(() => {
      // Unmuted autoplay worked — no extra UI needed.
      unmuteBtn.classList.add('hidden');
    })
    .catch(() => {
      // Blocked. Retry muted (this almost always succeeds on iOS).
      video.muted = true;
      video.play().catch(() => {
        // Even muted failed for some reason — show ready overlay so the
        // user isn't stuck staring at a frozen video.
        readyOverlay.classList.remove('hidden');
      });
      // Show the tap-for-sound button.
      unmuteBtn.classList.remove('hidden');
    });

  // Tapping the unmute button (or the video itself) enables sound. We
  // listen on the whole video element too, so the user can tap anywhere.
  function enableSound() {
    video.muted = false;
    // Setting muted doesn't restart playback, so volume comes on instantly.
    unmuteBtn.classList.add('hidden');
  }
  unmuteBtn.addEventListener('click', enableSound);
  video.addEventListener('click', enableSound);

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
