/*
  storage.js — tiny wrapper around localStorage.

  WHY a wrapper?
    - Centralizes all JSON parsing / stringifying in one place.
    - The rest of the app calls clear functions like getHabits() instead of
      having JSON.parse(localStorage.getItem(...)) scattered everywhere.
    - If we ever switch to IndexedDB, only this file changes.

  Data shape:
    habits        -> Array of { id, name, createdAt, days }
                       days = array of weekday numbers (0=Sun..6=Sat) on which
                       the habit is scheduled. Missing/empty = every day.
    completions   -> Object keyed by YYYY-MM-DD date strings, each value is
                     an object { habitId: true } for habits done that day.
*/

// Default set when the user doesn't pick any specific days = every day.
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const HABITS_KEY = 'habits';
const COMPLETIONS_KEY = 'completions';

// --- Generic helpers ---------------------------------------------------
// We read+write JSON. If parsing fails (corrupted storage), fall back to
// the default so the app still launches.
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Date helpers ------------------------------------------------------
// We use YYYY-MM-DD as the date key. Sortable as a string and timezone-stable
// because we build it from the LOCAL date parts (not toISOString, which
// converts to UTC and can shift by a day).
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Parse a YYYY-MM-DD key back into a local Date. We construct it with
// numeric parts (not new Date(string)) so the timezone stays local.
export function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Normalize the days field. If a habit was created before this field
// existed, or it's empty, treat it as "every day".
export function habitDays(habit) {
  return Array.isArray(habit.days) && habit.days.length > 0 ? habit.days : ALL_DAYS;
}

// Habits scheduled to appear on a given weekday (0=Sun..6=Sat).
export function habitsForWeekday(weekday, habits = getHabits()) {
  return habits.filter(h => habitDays(h).includes(weekday));
}

// --- Habits CRUD -------------------------------------------------------
export function getHabits() {
  return readJSON(HABITS_KEY, []);
}
export function saveHabits(habits) {
  writeJSON(HABITS_KEY, habits);
}
export function addHabit(name, days = ALL_DAYS) {
  const habits = getHabits();
  // crypto.randomUUID is supported in modern Safari/Chrome. Fallback to
  // Date.now() + random in case it's missing.
  const id = (crypto.randomUUID && crypto.randomUUID()) || `h_${Date.now()}_${Math.random()}`;
  // Copy the days array so callers can't mutate it later by accident.
  habits.push({ id, name: name.trim(), createdAt: Date.now(), days: [...days] });
  saveHabits(habits);
  return habits;
}
export function renameHabit(id, newName) {
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (h) { h.name = newName.trim(); saveHabits(habits); }
  return habits;
}
export function setHabitDays(id, days) {
  const habits = getHabits();
  const h = habits.find(x => x.id === id);
  if (h) { h.days = [...days]; saveHabits(habits); }
  return habits;
}
export function deleteHabit(id) {
  const habits = getHabits().filter(x => x.id !== id);
  saveHabits(habits);
  return habits;
}

// --- Completions -------------------------------------------------------
export function getAllCompletions() {
  return readJSON(COMPLETIONS_KEY, {});
}
export function getCompletionsForDate(key) {
  return getAllCompletions()[key] || {};
}
export function setCompletion(key, habitId, done) {
  const all = getAllCompletions();
  if (!all[key]) all[key] = {};
  if (done) {
    all[key][habitId] = true;
  } else {
    delete all[key][habitId];
    // Remove the date entirely if no habits remain — keeps storage tidy.
    if (Object.keys(all[key]).length === 0) delete all[key];
  }
  writeJSON(COMPLETIONS_KEY, all);
}

/*
  Returns the fraction of SCHEDULED habits completed on the given date,
  or null if no habits were scheduled that day (a "rest day").

  Why null instead of 0/1?
    - 0 would paint rest days as "failed" (gray) on the calendar.
    - 1 would paint them as "all done" (green) — also misleading.
    - null lets each caller decide: the calendar leaves them neutral,
      and the streak counter skips them so they don't break a streak.
*/
export function completionRatio(key, habits = getHabits()) {
  const weekday = dateFromKey(key).getDay();
  const scheduled = habitsForWeekday(weekday, habits);
  if (scheduled.length === 0) return null;
  const done = getCompletionsForDate(key);
  const doneCount = scheduled.filter(h => done[h.id]).length;
  return doneCount / scheduled.length;
}
