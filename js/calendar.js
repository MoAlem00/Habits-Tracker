/*
  calendar.js — monthly calendar with color-coded discipline.

  Coloring rules:
    - ratio === 1   -> green   (all habits done)
    - 0 < ratio < 1 -> yellow  (some done)
    - ratio === 0   -> gray    (none done)
    - future dates  -> dim, no color

  Streak: how many consecutive days ending TODAY (or yesterday if today
  isn't fully done yet) have ratio === 1.

  Total disciplined days: count of all days ever where ratio === 1.
*/

import { getHabits, completionRatio, dateKey, getAllCompletions } from './storage.js';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_HEADS = ['S','M','T','W','T','F','S'];

// We track which month is currently shown. Start on the current month.
let viewYear, viewMonth;

export function initCalendarScreen() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(+1));

  render();
}

// Called by app.js whenever we switch back to the calendar screen,
// so stats reflect any habit ticks made on the tracker screen.
export function refreshCalendar() { render(); }

function changeMonth(delta) {
  viewMonth += delta;
  // JS Date math: setting month to -1 or 12 rolls the year correctly,
  // but we're working with raw numbers so we handle it ourselves.
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0;  viewYear++; }
  render();
}

function render() {
  document.getElementById('month-label').textContent =
    `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  renderGrid();
  renderStats();
}

function renderGrid() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // Day-of-week headers (S M T W T F S).
  DAY_HEADS.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-head';
    h.textContent = d;
    grid.appendChild(h);
  });

  const habits = getHabits();
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDay = firstOfMonth.getDay(); // 0 = Sunday
  // Day 0 of next month = last day of this month. Clever JS trick:
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const todayKey = dateKey();
  const today = new Date();

  // Empty cells before day 1 so the 1st lands under the correct weekday.
  for (let i = 0; i < startDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewYear, viewMonth, day);
    const k = dateKey(d);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = String(day);

    const isFuture = d > today && k !== todayKey;
    if (isFuture) {
      cell.classList.add('future');
    } else {
      const ratio = completionRatio(k, habits);
      // null = rest day (no habits scheduled). Leave it gray with no
      // special class so it doesn't look like a "failed" day.
      if (ratio === null) {
        cell.classList.add('rest');
      } else if (ratio === 1) {
        cell.classList.add('green');
      } else if (ratio > 0) {
        cell.classList.add('yellow');
      }
      // ratio === 0 -> gray (default background)
    }

    if (k === todayKey) cell.classList.add('today');
    grid.appendChild(cell);
  }
}

function renderStats() {
  document.getElementById('stat-streak').textContent = calcStreak();
  document.getElementById('stat-total').textContent = calcTotalDisciplined();
}

/*
  Streak = consecutive "all done" days ending at today.

  Rest days (no habits scheduled) are SKIPPED — they neither break the
  streak nor count toward it. So Mon=done, Tue=rest, Wed=done is a 2-day
  streak, not 0 or 3.

  Today is treated specially: if it's not fully done yet, we don't let
  that break the streak — we start counting from yesterday instead.
*/
function calcStreak() {
  const habits = getHabits();
  if (habits.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();

  // Skip today if it's a rest day or not finished yet.
  const todayRatio = completionRatio(dateKey(cursor), habits);
  if (todayRatio === null || todayRatio < 1) {
    cursor.setDate(cursor.getDate() - 1);
  }

  // Walk backwards. Cap at 10 years to avoid runaway loops.
  for (let i = 0; i < 3650; i++) {
    const ratio = completionRatio(dateKey(cursor), habits);
    if (ratio === null) {
      // Rest day — skip, don't count, don't break.
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (ratio === 1) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/*
  Total disciplined days: count every stored date where every SCHEDULED
  habit was checked off. Rest days don't count (nothing was scheduled).
*/
function calcTotalDisciplined() {
  const habits = getHabits();
  if (habits.length === 0) return 0;
  const all = getAllCompletions();
  let total = 0;
  for (const k of Object.keys(all)) {
    if (completionRatio(k, habits) === 1) total++;
  }
  return total;
}
