const STORAGE_KEY = "ember-todo-v1";
const POINTS = { easy: 10, medium: 25, hard: 50 };

const els = {
  form: document.getElementById("task-form"),
  input: document.getElementById("task-input"),
  difficulty: document.getElementById("difficulty"),
  list: document.getElementById("task-list"),
  empty: document.getElementById("empty-state"),
  streak: document.getElementById("streak"),
  best: document.getElementById("best-streak"),
  points: document.getElementById("points"),
  todayLine: document.getElementById("today-line"),
  streakNote: document.getElementById("streak-note"),
  toast: document.getElementById("toast"),
};

let state = load();
let filter = "active";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    tasks: [],
    points: 0,
    streak: 0,
    bestStreak: 0,
    lastStreakDate: null,
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("is-on"), 2200);
}

function daysCompletedOn(date) {
  return state.tasks.filter((t) => t.done && t.completedOn === date).length;
}

function applyStreakOnComplete() {
  const today = todayKey();
  const yesterday = yesterdayKey();
  const alreadyToday = state.lastStreakDate === today;

  if (alreadyToday) return { streakGrew: false, started: false };

  if (state.lastStreakDate === yesterday) {
    state.streak += 1;
  } else {
    state.streak = 1;
  }

  state.lastStreakDate = today;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;
  return { streakGrew: state.streak > 1, started: state.streak === 1 };
}

function maybeBreakStreak() {
  const today = todayKey();
  const yesterday = yesterdayKey();
  if (!state.lastStreakDate) return;
  if (state.lastStreakDate === today || state.lastStreakDate === yesterday) return;
  state.streak = 0;
}

function retractTodayIfEmpty() {
  const today = todayKey();
  if (state.lastStreakDate !== today) return;
  if (daysCompletedOn(today) > 0) return;
  state.streak = Math.max(0, state.streak - 1);
  state.lastStreakDate = state.streak > 0 ? yesterdayKey() : null;
}

function addTask(text, difficulty) {
  state.tasks.unshift({
    id: crypto.randomUUID(),
    text,
    difficulty,
    done: false,
    createdAt: Date.now(),
    completedOn: null,
  });
  save();
  render();
}

function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  if (!task.done) {
    task.done = true;
    task.completedOn = todayKey();
    const earned = POINTS[task.difficulty] || POINTS.medium;
    state.points += earned;
    const streakInfo = applyStreakOnComplete();
    save();
    render();
    if (streakInfo.streakGrew) {
      toast(`+${earned} pts · streak ${state.streak} days`);
    } else if (streakInfo.started) {
      toast(`+${earned} pts · streak started`);
    } else {
      toast(`+${earned} points`);
    }
    return;
  }

  const refund = POINTS[task.difficulty] || POINTS.medium;
  task.done = false;
  task.completedOn = null;
  state.points = Math.max(0, state.points - refund);
  retractTodayIfEmpty();
  save();
  render();
}

function deleteTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (task?.done) {
    const refund = POINTS[task.difficulty] || POINTS.medium;
    state.points = Math.max(0, state.points - refund);
  }
  state.tasks = state.tasks.filter((t) => t.id !== id);
  retractTodayIfEmpty();
  save();
  render();
}

function visibleTasks() {
  if (filter === "active") return state.tasks.filter((t) => !t.done);
  if (filter === "done") return state.tasks.filter((t) => t.done);
  return state.tasks;
}

function streakCopy() {
  const today = todayKey();
  const yesterday = yesterdayKey();
  if (!state.lastStreakDate) {
    return "Complete a task today to light the streak.";
  }
  if (state.lastStreakDate === today) {
    return "Streak is safe for today. Come back tomorrow.";
  }
  if (state.lastStreakDate === yesterday) {
    return "Finish one task today to keep your streak.";
  }
  return "The fire went out. Complete a task to start again.";
}

function render() {
  maybeBreakStreak();
  els.streak.textContent = String(state.streak);
  els.best.textContent = String(state.bestStreak);
  els.points.textContent = String(state.points);

  const todayCount = daysCompletedOn(todayKey());
  els.todayLine.textContent = `${todayCount} done today`;
  els.streakNote.textContent = streakCopy();

  const tasks = visibleTasks();
  els.list.innerHTML = "";
  els.empty.classList.toggle("is-hidden", tasks.length > 0);
  els.empty.textContent =
    filter === "done"
      ? "Nothing completed yet."
      : filter === "all"
        ? "Your list is empty. Add a task."
        : state.lastStreakDate === todayKey()
          ? "All caught up. Add another task when you're ready."
          : "No open tasks. Add one and start a streak.";

  for (const task of tasks) {
    const li = document.createElement("li");
    li.className = `task${task.done ? " is-done" : ""}`;

    const check = document.createElement("button");
    check.className = "check";
    check.type = "button";
    check.setAttribute("aria-label", task.done ? "Mark incomplete" : "Mark complete");
    check.textContent = task.done ? "✓" : "";
    check.addEventListener("click", () => toggleTask(task.id));

    const body = document.createElement("div");
    const title = document.createElement("p");
    title.className = "task-title";
    title.textContent = task.text;
    const meta = document.createElement("p");
    meta.className = "task-meta";
    meta.textContent = task.difficulty;
    body.append(title, meta);

    const chip = document.createElement("span");
    chip.className = "points-chip";
    chip.textContent = `+${POINTS[task.difficulty]}`;

    const del = document.createElement("button");
    del.className = "delete";
    del.type = "button";
    del.setAttribute("aria-label", "Delete task");
    del.textContent = "×";
    del.addEventListener("click", () => deleteTask(task.id));

    li.append(check, body, chip, del);
    els.list.append(li);
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  addTask(text, els.difficulty.value);
  els.input.value = "";
  els.input.focus();
});

document.querySelectorAll(".filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filter").forEach((b) => b.classList.toggle("is-active", b === btn));
    render();
  });
});

render();
