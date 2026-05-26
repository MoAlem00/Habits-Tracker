/*
  app.js — entry point.

  Responsibilities:
    1. Register the service worker so the app works offline / installable.
    2. Wire the three screens together (video -> tracker, tracker <-> calendar).
    3. Kick off each screen's own init function.
*/

import { initVideoScreen } from './js/video.js';
import { initTrackerScreen, renderAll as renderTracker } from './js/habits.js';
import { initCalendarScreen, refreshCalendar } from './js/calendar.js';

// ----- Service worker -------------------------------------------------
// Service workers enable offline use and proper PWA installability.
// We register it from the page root so its scope covers the whole app.
// 'load' event = wait until the page is done loading; SW registration
// is non-critical, so we don't block the UI on it.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      // Logging only — a failed SW registration just means no offline.
      console.warn('SW registration failed:', err);
    });
  });
}

// ----- Tiny screen "router" ------------------------------------------
// We keep this in app.js (instead of a separate file) because it's
// only ~10 lines and the whole app has 3 screens.
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ----- Bootstrapping --------------------------------------------------
// Order: init every screen so their event listeners are attached, then
// start on the video screen.
initTrackerScreen();
initCalendarScreen();

initVideoScreen(() => {
  // Called when the user is "ready" (video ended or skipped).
  renderTracker();      // refresh in case the date rolled over while video played
  showScreen('tracker-screen');
});

// Navigation between tracker and calendar.
document.getElementById('go-calendar').addEventListener('click', () => {
  refreshCalendar();
  showScreen('calendar-screen');
});
document.getElementById('back-to-tracker').addEventListener('click', () => {
  renderTracker();
  showScreen('tracker-screen');
});
