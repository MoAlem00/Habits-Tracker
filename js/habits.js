/*
  habits.js — the tracker screen.

  Responsibilities:
    - Render today's habit list (tap a row to toggle done).
    - Render the 7-day "week strip" of progress rings (iPhone Fitness style).
    - Handle adding new habits.
    - Handle the "Manage habits" modal (rename + delete).
*/

import {
  getHabits, addHabit, renameHabit, deleteHabit, setHabitDays,
  getCompletionsForDate, setCompletion,
  completionRatio, dateKey, habitDays, habitsForWeekday,
} from './storage.js';

// Day-of-week labels for the strip. The strip shows the LAST 7 days
// ending with today on the right — same as Apple's Fitness app.
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Days selected for the NEXT habit the user is about to add.
// Reset to "every day" after each add. Module-level state is fine here
// because there's only one Add row in the app.
let addDraftDays = [0, 1, 2, 3, 4, 5, 6];

// Which week the strip is currently showing.
//   0  = current week (Sun-Sat containing today)
//  -1  = last week
//  -2  = two weeks ago, etc.
// We don't allow positive values (no future weeks).
let weekOffset = 0;

export function initTrackerScreen() {
  renderAll();

  // --- Add habit -----------------------------------------------------
  const input = document.getElementById('new-habit-input');
  const addBtn = document.getElementById('add-habit-btn');

  function tryAdd() {
    const name = input.value.trim();
    if (!name) return;   // ignore empty input
    // If somehow no days are selected, default back to every day so the
    // habit isn't invisible forever.
    const days = addDraftDays.length > 0 ? addDraftDays : [0,1,2,3,4,5,6];
    addHabit(name, days);
    input.value = '';
    addDraftDays = [0, 1, 2, 3, 4, 5, 6]; // reset selection for next time
    renderAll();
  }
  addBtn.addEventListener('click', tryAdd);
  // Enter key on the keyboard should also add — feels natural on mobile.
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryAdd(); });

  // Render the initial day picker under the Add input.
  renderAddDayPicker();

  // --- Week navigation ----------------------------------------------
  document.getElementById('prev-week').addEventListener('click', () => {
    weekOffset -= 1;
    renderWeekStrip();
  });
  document.getElementById('next-week').addEventListener('click', () => {
    // Clamp to 0 — never show future weeks.
    if (weekOffset < 0) {
      weekOffset += 1;
      renderWeekStrip();
    }
  });

  // Swipe gestures on the strip. We track the touch's start X and Y;
  // if the user moves more horizontally than vertically and crosses a
  // threshold, treat it as a week change. Otherwise we let the page
  // scroll normally (handled by `touch-action: pan-y` in the CSS).
  const strip = document.getElementById('week-strip');
  let touchStartX = 0, touchStartY = 0;
  strip.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  strip.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Require a horizontal-dominant swipe of at least 40px.
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        weekOffset -= 1;             // swipe right -> previous (older) week
      } else if (weekOffset < 0) {
        weekOffset += 1;             // swipe left -> newer week (clamp at 0)
      }
      renderWeekStrip();
    }
  });

  // --- Manage modal --------------------------------------------------
  document.getElementById('manage-btn').addEventListener('click', openManage);
  document.getElementById('close-manage').addEventListener('click', closeManage);

  // --- Day detail modal ---------------------------------------------
  document.getElementById('close-day-detail').addEventListener('click', closeDayDetail);
}

/*
  Re-render every dynamic part of the tracker screen.
  We use a simple "wipe and rebuild" strategy. For a list of habits
  measured in tens, this is fast enough and far easier to reason
  about than diff-based updates.
*/
export function renderAll() {
  renderTodayLabel();
  renderWeekStrip();
  renderHabitsList();
}

function renderTodayLabel() {
  const el = document.getElementById('today-label');
  // Friendly format: "Tue, May 26"
  const now = new Date();
  el.textContent = now.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/*
  Week strip: 7 SVG progress rings, one per day — Sunday on the left,
  Saturday on the right (standard US calendar week).

  `weekOffset` (module-level) controls which week is shown:
    0  -> current week, -1 -> last week, etc.
  We also update the date-range label and disable the "next" arrow
  when we're already on the current week.
*/
function renderWeekStrip() {
  const strip = document.getElementById('week-strip');
  strip.innerHTML = '';

  const habits = getHabits();
  const today = new Date();
  const todayKey = dateKey(today);

  // Find the Sunday of the displayed week.
  // today.getDay() returns 0..6 with 0=Sunday, so subtracting it lands
  // us on the most recent Sunday. Then shift by 7 * weekOffset.
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay() + weekOffset * 7);

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const k = dateKey(d);

    const isFuture = d > today && k !== todayKey;
    // Future days: show an empty ring, no fill, dimmed.
    const ratio = isFuture ? null : completionRatio(k, habits);

    const dayEl = document.createElement('div');
    dayEl.className = 'week-day';
    if (k === todayKey) dayEl.classList.add('today');
    if (isFuture) dayEl.classList.add('future');

    // Tapping a past or current day opens the detail modal.
    // Future days are non-interactive — nothing to show yet.
    if (!isFuture) {
      dayEl.classList.add('tappable');
      // Capture a copy of the date so the closure doesn't see the loop's
      // shared variable after it advances.
      const captured = new Date(d);
      dayEl.addEventListener('click', () => openDayDetail(captured));
    }

    dayEl.appendChild(buildRing(ratio));

    const label = document.createElement('div');
    label.className = 'week-day-label';
    // Letter (S M T W T F S) on top, day-of-month below it.
    label.innerHTML = `${DAY_LETTERS[d.getDay()]}<br><span class="week-day-num">${d.getDate()}</span>`;
    dayEl.appendChild(label);

    strip.appendChild(dayEl);
  }

  // Update label + arrow state.
  updateWeekLabel(sunday);
}

function updateWeekLabel(sunday) {
  const label = document.getElementById('week-label');
  const nextBtn = document.getElementById('next-week');

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  if (weekOffset === 0) {
    label.textContent = 'This week';
  } else if (weekOffset === -1) {
    label.textContent = 'Last week';
  } else {
    // Friendly range, e.g. "May 5 – 11".
    const opts = { month: 'short', day: 'numeric' };
    const a = sunday.toLocaleDateString(undefined, opts);
    const b = saturday.toLocaleDateString(undefined, opts);
    label.textContent = `${a} – ${b}`;
  }

  // Disable "next" when already on the current week.
  nextBtn.disabled = weekOffset >= 0;
}

/*
  Build an SVG progress ring.
  Math: circumference = 2 * PI * r. We use stroke-dasharray = circumference
  to make the dash equal one full loop, then stroke-dashoffset = (1 - ratio) * C
  to "erase" the unfilled portion.
*/
function buildRing(ratio) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('viewBox', '0 0 36 36');

  const r = 15;
  const c = 2 * Math.PI * r; // circumference

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('cx', '18'); track.setAttribute('cy', '18'); track.setAttribute('r', r);
  track.setAttribute('class', 'ring-track');
  svg.appendChild(track);

  // Rest day (ratio === null) shows only the empty track.
  if (ratio === null) return svg;

  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fill.setAttribute('cx', '18'); fill.setAttribute('cy', '18'); fill.setAttribute('r', r);
  fill.setAttribute('class', 'ring-fill');
  fill.setAttribute('stroke-dasharray', c);
  fill.setAttribute('stroke-dashoffset', c * (1 - ratio));
  svg.appendChild(fill);

  return svg;
}

/*
  Render today's habit rows. Each row is a tappable element; tapping
  toggles completion for today and re-renders so the UI (and the week
  strip's "today" ring) updates immediately.

  Only habits scheduled for today's weekday are shown — soccer doesn't
  clutter Tuesday's list if it's a Friday-only habit.
*/
function renderHabitsList() {
  const list = document.getElementById('habits-list');
  list.innerHTML = '';

  const allHabits = getHabits();
  const todayWeekday = new Date().getDay();
  const habits = habitsForWeekday(todayWeekday, allHabits);

  if (allHabits.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-msg';
    empty.textContent = 'No habits yet. Add one below to get started.';
    list.appendChild(empty);
    return;
  }
  if (habits.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-msg';
    empty.textContent = 'Rest day — no habits scheduled for today. Enjoy it.';
    list.appendChild(empty);
    return;
  }

  const today = dateKey();
  const doneMap = getCompletionsForDate(today);

  habits.forEach(habit => {
    const li = document.createElement('li');
    li.className = 'habit-row' + (doneMap[habit.id] ? ' done' : '');

    const check = document.createElement('div');
    check.className = 'check';
    check.textContent = '✓';
    li.appendChild(check);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = habit.name;
    li.appendChild(name);

    li.addEventListener('click', () => {
      const currentlyDone = !!getCompletionsForDate(today)[habit.id];
      setCompletion(today, habit.id, !currentlyDone);
      renderAll(); // also refreshes today's ring in the week strip
    });

    list.appendChild(li);
  });
}

// ===================== DAY PICKER =====================
/*
  Builds a row of 7 toggle chips (S M T W T F S).
  `selected` is the current array of selected weekday numbers.
  `onChange(newSelected)` is called whenever the user toggles a chip.

  This is shared between the Add row and each row in the Manage modal —
  one component, two use sites, keeps the UI consistent.
*/
function buildDayPicker(selected, onChange) {
  const row = document.createElement('div');
  row.className = 'day-picker';

  DAY_LETTERS.forEach((letter, weekday) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'day-chip' + (selected.includes(weekday) ? ' active' : '');
    chip.textContent = letter;
    chip.setAttribute('aria-pressed', selected.includes(weekday));
    chip.addEventListener('click', () => {
      // Toggle this weekday in/out of the selected array.
      const next = selected.includes(weekday)
        ? selected.filter(d => d !== weekday)
        : [...selected, weekday].sort();
      onChange(next);
    });
    row.appendChild(chip);
  });

  return row;
}

function renderAddDayPicker() {
  const container = document.getElementById('add-day-picker');
  container.innerHTML = '';
  container.appendChild(buildDayPicker(addDraftDays, (next) => {
    addDraftDays = next;
    renderAddDayPicker(); // re-render to reflect the new selection
  }));
}

// ===================== MANAGE MODAL =====================
function openManage() {
  const modal = document.getElementById('manage-modal');
  const list = document.getElementById('manage-list');
  list.innerHTML = '';

  const habits = getHabits();
  if (habits.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-msg';
    li.textContent = 'No habits yet.';
    list.appendChild(li);
  }

  habits.forEach(habit => {
    const li = document.createElement('li');
    li.className = 'manage-row';

    // Top row: name input + delete button.
    const top = document.createElement('div');
    top.className = 'manage-row-top';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = habit.name;
    // 'change' fires when the user finishes editing (blur or Enter).
    input.addEventListener('change', () => {
      renameHabit(habit.id, input.value || habit.name);
    });
    top.appendChild(input);

    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete habit');
    del.addEventListener('click', () => {
      // confirm() is a built-in browser dialog — fine for a personal app.
      if (confirm(`Delete "${habit.name}"?`)) {
        deleteHabit(habit.id);
        openManage();   // re-render the modal in place
        renderAll();    // also update the main screen behind it
      }
    });
    top.appendChild(del);
    li.appendChild(top);

    // Bottom row: day picker for this habit.
    // habitDays(habit) returns "every day" for legacy habits without a
    // `days` field — keeps old data sensible.
    const picker = buildDayPicker(habitDays(habit), (next) => {
      setHabitDays(habit.id, next);
      openManage();   // re-render so the chip's "active" state updates
    });
    li.appendChild(picker);

    list.appendChild(li);
  });

  modal.classList.remove('hidden');
}

function closeManage() {
  document.getElementById('manage-modal').classList.add('hidden');
  renderAll();
}

// ===================== DAY DETAIL MODAL =====================
/*
  Opens a modal showing every habit scheduled for the given date, with
  a check on each row indicating done/not-done. Tapping a row toggles
  completion for that specific date (so you can also fix past days).

  Why use habitsForWeekday + the date's weekday?
    - "Scheduled" is defined by the habit's `days` field, which is a
      weekday set. So past Sundays show what's currently scheduled on
      Sundays — consistent with how the rings/calendar already color days.
*/
function openDayDetail(date) {
  const modal = document.getElementById('day-detail-modal');
  const title = document.getElementById('day-detail-title');
  const list = document.getElementById('day-detail-list');
  const key = dateKey(date);

  // Friendly title: "Sunday, May 24"
  title.textContent = date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  list.innerHTML = '';
  const habits = habitsForWeekday(date.getDay());
  if (habits.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-msg';
    empty.textContent = 'Rest day — no habits were scheduled.';
    list.appendChild(empty);
    modal.classList.remove('hidden');
    return;
  }

  const doneMap = getCompletionsForDate(key);
  habits.forEach(habit => {
    const li = document.createElement('li');
    li.className = 'habit-row' + (doneMap[habit.id] ? ' done' : '');

    const check = document.createElement('div');
    check.className = 'check';
    check.textContent = '✓';
    li.appendChild(check);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = habit.name;
    li.appendChild(name);

    li.addEventListener('click', () => {
      const currentlyDone = !!getCompletionsForDate(key)[habit.id];
      setCompletion(key, habit.id, !currentlyDone);
      openDayDetail(date); // re-render the modal so the row updates
      renderAll();         // also refresh the week strip behind it
    });

    list.appendChild(li);
  });

  modal.classList.remove('hidden');
}

function closeDayDetail() {
  document.getElementById('day-detail-modal').classList.add('hidden');
}
