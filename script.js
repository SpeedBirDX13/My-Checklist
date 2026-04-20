const STORAGE_KEY = "productivity-dashboard-state";

const quotes = [
  { text: "Life is like riding a bicycle. To keep your balance, you must keep moving.", author: "Albert Einstein" },
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.", author: "Richard Feynman" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius" },
  { text: "I would rather have questions that cannot be answered than answers that cannot be questioned.", author: "Richard Feynman" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Waste no more time arguing what a good person should be. Be one.", author: "Marcus Aurelius" }
];

const defaultState = {
  selectedDate: "",
  theme: "light",
  tasksByDate: {},
  codingPracticeByDate: {}
};

const elements = {
  body: document.body,
  prettyDate: document.getElementById("prettyDate"),
  datePicker: document.getElementById("datePicker"),
  selectedDateLabel: document.getElementById("selectedDateLabel"),
  taskPanelTitle: document.getElementById("taskPanelTitle"),
  jumpTodayBtn: document.getElementById("jumpTodayBtn"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  priorityToggle: document.getElementById("priorityToggle"),
  taskList: document.getElementById("taskList"),
  completionPercent: document.getElementById("completionPercent"),
  completionMeta: document.getElementById("completionMeta"),
  priorityCount: document.getElementById("priorityCount"),
  archiveCount: document.getElementById("archiveCount"),
  completedTodayLabel: document.getElementById("completedTodayLabel"),
  rankBadge: document.getElementById("rankBadge"),
  ringPercent: document.getElementById("ringPercent"),
  progressRing: document.getElementById("progressRing"),
  yearCompleted: document.getElementById("yearCompleted"),
  bestDayCount: document.getElementById("bestDayCount"),
  bestDayLabel: document.getElementById("bestDayLabel"),
  monthlyRate: document.getElementById("monthlyRate"),
  archiveList: document.getElementById("archiveList"),
  quoteText: document.getElementById("quoteText"),
  quoteAuthor: document.getElementById("quoteAuthor"),
  themeChips: Array.from(document.querySelectorAll(".theme-chip")),
  rangeButtons: Array.from(document.querySelectorAll(".range-btn")),
  codingStatusTitle: document.getElementById("codingStatusTitle"),
  codingStatusText: document.getElementById("codingStatusText"),
  codingToggleBtn: document.getElementById("codingToggleBtn"),
  codingMonthCount: document.getElementById("codingMonthCount"),
  codingYearCount: document.getElementById("codingYearCount"),
  codingRangeButtons: Array.from(document.querySelectorAll(".code-range-btn"))
};

let state = loadState();
let nextTaskPriority = false;
let currentRange = "weekly";
let currentCodingRange = "monthly";
let progressChart;
let codingChart;

initialize();

function initialize() {
  const today = getTodayKey();
  state.selectedDate = today;
  if (!state.tasksByDate[state.selectedDate]) {
    state.tasksByDate[state.selectedDate] = [];
  }

  applyTheme(state.theme);
  elements.datePicker.value = state.selectedDate;
  renderAll();
  bindEvents();
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.priorityToggle.addEventListener("click", toggleNewTaskPriority);
  elements.datePicker.addEventListener("change", handleDateChange);
  elements.codingToggleBtn.addEventListener("click", toggleCodingPracticeForToday);
  elements.jumpTodayBtn.addEventListener("click", () => {
    state.selectedDate = getTodayKey();
    ensureDateEntry(state.selectedDate);
    persist();
    renderAll();
  });

  elements.taskList.addEventListener("click", (event) => {
    const taskItem = event.target.closest(".task-item");
    if (!taskItem) return;
    const taskId = taskItem.dataset.id;

    if (event.target.closest(".complete-toggle")) {
      toggleTaskComplete(taskId);
    }

    if (event.target.closest(".star-btn")) {
      toggleTaskPriority(taskId);
    }

    if (event.target.closest(".delete-btn")) {
      removeTask(taskId, taskItem);
    }
  });

  elements.themeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      applyTheme(chip.dataset.themeTarget);
      state.theme = chip.dataset.themeTarget;
      persist();
      renderChart();
      renderCodingChart();
    });
  });

  elements.rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentRange = button.dataset.range;
      syncRangeButtons();
      renderChart();
    });
  });

  elements.codingRangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentCodingRange = button.dataset.codeRange;
      syncCodingRangeButtons();
      renderCodingChart();
    });
  });

  elements.archiveList.addEventListener("click", (event) => {
    const button = event.target.closest(".archive-date");
    if (!button) return;
    state.selectedDate = button.dataset.date;
    ensureDateEntry(state.selectedDate);
    persist();
    renderAll();
  });
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const text = elements.taskInput.value.trim();
  if (!text) {
    elements.taskInput.focus();
    return;
  }

  const tasks = getSelectedTasks();
  tasks.unshift({
    id: createId(),
    text,
    completed: false,
    priority: nextTaskPriority,
    createdAt: new Date().toISOString()
  });

  state.tasksByDate[state.selectedDate] = tasks;
  persist();
  elements.taskInput.value = "";
  setNewTaskPriority(false);
  renderAll();
  elements.taskInput.focus();
}

function handleDateChange(event) {
  state.selectedDate = event.target.value || getTodayKey();
  ensureDateEntry(state.selectedDate);
  persist();
  renderAll();
}

function toggleNewTaskPriority() {
  setNewTaskPriority(!nextTaskPriority);
}

function setNewTaskPriority(isPriority) {
  nextTaskPriority = isPriority;
  elements.priorityToggle.classList.toggle("active", isPriority);
  elements.priorityToggle.setAttribute("aria-pressed", String(isPriority));
  elements.priorityToggle.textContent = isPriority ? "Priority On" : "Priority Off";
}

function toggleTaskComplete(taskId) {
  const tasks = getSelectedTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  const wasComplete = task.completed;
  task.completed = !task.completed;
  persist();
  renderAll();

  if (!wasComplete && task.completed) {
    const allComplete = getSelectedTasks().length > 0 && getSelectedTasks().every((item) => item.completed);
    launchConfetti(allComplete);
  }
}

function toggleTaskPriority(taskId) {
  const tasks = getSelectedTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.priority = !task.priority;
  persist();
  renderAll();
}

function removeTask(taskId, taskItem) {
  taskItem.classList.add("removing");
  window.setTimeout(() => {
    state.tasksByDate[state.selectedDate] = getSelectedTasks().filter((task) => task.id !== taskId);
    persist();
    renderAll();
  }, 180);
}

function renderAll() {
  ensureDateEntry(state.selectedDate);
  elements.datePicker.value = state.selectedDate;
  renderHeader();
  renderTasks();
  renderProgress();
  renderArchive();
  renderQuote();
  renderSummary();
  renderCodingPractice();
  syncThemeChips();
  syncRangeButtons();
  syncCodingRangeButtons();
  renderChart();
  renderCodingChart();
}

function renderHeader() {
  const isToday = state.selectedDate === getTodayKey();
  elements.prettyDate.textContent = formatLongDate(state.selectedDate);
  elements.selectedDateLabel.textContent = formatMediumDate(state.selectedDate);
  elements.taskPanelTitle.textContent = isToday ? "Tasks for Today" : `Tasks for ${formatMediumDate(state.selectedDate)}`;
}

function renderTasks() {
  const tasks = getSelectedTasks();
  if (!tasks.length) {
    elements.taskList.innerHTML = '<li class="empty-state">No tasks for this date yet. Create a focused list and the dashboard will track it automatically.</li>';
    return;
  }

  elements.taskList.innerHTML = tasks.map((task) => `
    <li class="task-item ${task.completed ? "completed" : ""} ${task.priority ? "priority" : ""}" data-id="${task.id}">
      <button class="complete-toggle ${task.completed ? "is-checked" : ""}" type="button" aria-label="Toggle completion">${task.completed ? "Done" : "Open"}</button>
      <div class="task-main">
        <p class="task-text">${escapeHtml(task.text)}</p>
        <div class="task-meta">
          <span>${task.completed ? "Completed" : "In progress"}</span>
          ${task.priority ? '<span class="priority-tag">High priority</span>' : ""}
        </div>
      </div>
      <button class="star-btn ${task.priority ? "is-priority" : ""}" type="button" aria-label="Toggle priority">${task.priority ? "Starred" : "Star"}</button>
      <button class="delete-btn" type="button" aria-label="Delete task">Delete</button>
    </li>
  `).join("");
}

function renderProgress() {
  const tasks = getSelectedTasks();
  const completed = tasks.filter((task) => task.completed).length;
  const priorityCount = tasks.filter((task) => task.priority).length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const archives = getArchiveDates().length;

  elements.completionPercent.textContent = `${percent}%`;
  elements.completionMeta.textContent = `${completed} of ${tasks.length} tasks complete`;
  elements.priorityCount.textContent = String(priorityCount);
  elements.archiveCount.textContent = String(archives);
  elements.completedTodayLabel.textContent = String(completed);
  elements.ringPercent.textContent = `${percent}%`;
  elements.progressRing.style.setProperty("--progress-angle", `${Math.round((percent / 100) * 360)}deg`);
}

function renderArchive() {
  const archiveDates = getArchiveDates().slice(0, 18);
  if (!archiveDates.length) {
    elements.archiveList.innerHTML = '<span class="empty-state">Your past dated checklists will appear here automatically.</span>';
    return;
  }

  elements.archiveList.innerHTML = archiveDates.map((date) => `
    <button class="archive-date ${date === state.selectedDate ? "active" : ""}" type="button" data-date="${date}">
      ${escapeHtml(formatShortDate(date))}
    </button>
  `).join("");
}

function renderQuote() {
  const selected = quotes[getDateHash(state.selectedDate) % quotes.length];
  elements.quoteText.textContent = `"${selected.text}"`;
  elements.quoteAuthor.textContent = selected.author;
}

function renderSummary() {
  const currentYear = Number(state.selectedDate.slice(0, 4));
  const entries = Object.entries(state.tasksByDate);
  const yearEntries = entries.filter(([date]) => Number(date.slice(0, 4)) === currentYear);

  let totalCompleted = 0;
  let bestDay = { date: "", count: 0 };

  for (const [date, tasks] of yearEntries) {
    const completed = tasks.filter((task) => task.completed).length;
    totalCompleted += completed;
    if (completed > bestDay.count) {
      bestDay = { date, count: completed };
    }
  }

  const monthRate = getMonthlyCompletionRate(state.selectedDate);
  const rank = getRank(monthRate);

  elements.yearCompleted.textContent = String(totalCompleted);
  elements.bestDayCount.textContent = String(bestDay.count);
  elements.bestDayLabel.textContent = bestDay.date ? formatMediumDate(bestDay.date) : "No data yet";
  elements.monthlyRate.textContent = `${monthRate}%`;
  elements.rankBadge.textContent = rank;
}

function renderCodingPractice() {
  const today = getTodayKey();
  const todayDone = Boolean(state.codingPracticeByDate[today] && state.codingPracticeByDate[today].completed);

  elements.codingStatusTitle.textContent = todayDone ? "Done for today" : "Not done yet";
  elements.codingStatusText.textContent = todayDone
    ? "Nice. You've already completed your 30 minutes of coding practice today."
    : "Mark this when you've completed at least 30 minutes of coding today.";
  elements.codingToggleBtn.textContent = todayDone ? "Undo Today's Coding Check" : "Mark 30 Minutes Done";
  elements.codingMonthCount.textContent = String(countCodingDaysInMonth(state.selectedDate));
  elements.codingYearCount.textContent = String(countCodingDaysInYear(state.selectedDate));
}

function renderChart() {
  const config = getChartData(currentRange, state.selectedDate);
  const ctx = document.getElementById("progressChart");
  if (!ctx) return;

  if (progressChart) {
    progressChart.destroy();
  }

  progressChart = new Chart(ctx, {
    type: currentRange === "weekly" ? "line" : "bar",
    data: {
      labels: config.labels,
      datasets: [
        {
          label: "Completed tasks",
          data: config.values,
          borderColor: getComputedStyle(document.body).getPropertyValue("--accent").trim(),
          backgroundColor: currentRange === "weekly"
            ? createChartGradient(ctx)
            : getComputedStyle(document.body).getPropertyValue("--accent-2").trim(),
          tension: 0.36,
          fill: currentRange === "weekly",
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 5,
          maxBarThickness: 28
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          displayColors: false,
          callbacks: {
            label: (context) => `${context.parsed.y} completed`
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: getComputedStyle(document.body).getPropertyValue("--muted").trim()
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: getComputedStyle(document.body).getPropertyValue("--muted").trim()
          },
          grid: {
            color: "rgba(128, 128, 128, 0.14)"
          }
        }
      }
    }
  });
}

function renderCodingChart() {
  const canvas = document.getElementById("codingChart");
  if (!canvas) return;

  if (codingChart) {
    codingChart.destroy();
  }

  const config = getCodingChartData(currentCodingRange, state.selectedDate);

  codingChart = new Chart(canvas, {
    type: currentCodingRange === "monthly" ? "bar" : "line",
    data: {
      labels: config.labels,
      datasets: [
        {
          label: "Coding practice",
          data: config.values,
          borderColor: getComputedStyle(document.body).getPropertyValue("--accent").trim(),
          backgroundColor: currentCodingRange === "monthly"
            ? getComputedStyle(document.body).getPropertyValue("--accent-2").trim()
            : createChartGradient(canvas),
          fill: currentCodingRange === "yearly",
          tension: 0.34,
          borderWidth: 2.5,
          pointRadius: currentCodingRange === "yearly" ? 4 : 0,
          maxBarThickness: 20
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          displayColors: false,
          callbacks: {
            label: (context) => currentCodingRange === "monthly"
              ? `${context.parsed.y ? "Practiced" : "Missed"} on this day`
              : `${context.parsed.y} coding day${context.parsed.y === 1 ? "" : "s"}`
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: getComputedStyle(document.body).getPropertyValue("--muted").trim()
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            color: getComputedStyle(document.body).getPropertyValue("--muted").trim()
          },
          grid: {
            color: "rgba(128, 128, 128, 0.14)"
          }
        }
      }
    }
  });
}

function createChartGradient(canvas) {
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 280);
  const styles = getComputedStyle(document.body);
  gradient.addColorStop(0, `${styles.getPropertyValue("--accent").trim()}bb`);
  gradient.addColorStop(1, `${styles.getPropertyValue("--accent-2").trim()}10`);
  return gradient;
}

function getChartData(range, selectedDate) {
  if (range === "weekly") {
    const days = getPreviousDates(selectedDate, 6);
    return {
      labels: days.map((date) => formatWeekday(date)),
      values: days.map((date) => countCompleted(date))
    };
  }

  const monthDates = getMonthDates(selectedDate);
  return {
    labels: monthDates.map((date) => date.slice(-2)),
    values: monthDates.map((date) => countCompleted(date))
  };
}

function getCodingChartData(range, selectedDate) {
  if (range === "monthly") {
    const monthDates = getMonthDates(selectedDate);
    return {
      labels: monthDates.map((date) => date.slice(-2)),
      values: monthDates.map((date) => state.codingPracticeByDate[date] && state.codingPracticeByDate[date].completed ? 1 : 0)
    };
  }

  const year = Number(selectedDate.slice(0, 4));
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const values = labels.map((_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return Object.entries(state.codingPracticeByDate).filter(([date, entry]) => {
      return entry.completed && date.startsWith(`${year}-${month}-`);
    }).length;
  });

  return { labels, values };
}

function getPreviousDates(endDate, daysBack) {
  const dates = [];
  for (let i = daysBack; i >= 0; i -= 1) {
    const date = new Date(`${endDate}T00:00:00`);
    date.setDate(date.getDate() - i);
    dates.push(formatISODate(date));
  }
  return dates;
}

function getMonthDates(dateString) {
  const [year, month] = dateString.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const dates = [];
  for (let day = 1; day <= lastDay; day += 1) {
    dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

function countCompleted(date) {
  return (state.tasksByDate[date] || []).filter((task) => task.completed).length;
}

function countCodingDaysInMonth(dateString) {
  return getMonthDates(dateString).filter((date) => state.codingPracticeByDate[date] && state.codingPracticeByDate[date].completed).length;
}

function countCodingDaysInYear(dateString) {
  const year = dateString.slice(0, 4);
  return Object.entries(state.codingPracticeByDate).filter(([date, entry]) => entry.completed && date.startsWith(`${year}-`)).length;
}

function getMonthlyCompletionRate(dateString) {
  const monthDates = getMonthDates(dateString);
  let totalTasks = 0;
  let completedTasks = 0;

  for (const date of monthDates) {
    const tasks = state.tasksByDate[date] || [];
    totalTasks += tasks.length;
    completedTasks += tasks.filter((task) => task.completed).length;
  }

  if (totalTasks === 0) return 0;
  return Math.round((completedTasks / totalTasks) * 100);
}

function getRank(rate) {
  if (rate >= 85) return "Master";
  if (rate >= 55) return "Achiever";
  return "Starter";
}

function toggleCodingPracticeForToday() {
  const today = getTodayKey();
  const current = Boolean(state.codingPracticeByDate[today] && state.codingPracticeByDate[today].completed);

  state.codingPracticeByDate[today] = {
    completed: !current,
    minutes: !current ? 30 : 0
  };

  persist();
  renderCodingPractice();
  renderCodingChart();
}

function launchConfetti(isFinalTask) {
  if (typeof confetti !== "function") return;

  const baseConfig = {
    colors: ["#5578ff", "#1ec7a2", "#ffd166", "#ff7a90", "#ffffff"],
    origin: { y: 0.74 }
  };

  confetti({
    ...baseConfig,
    particleCount: isFinalTask ? 220 : 110,
    spread: isFinalTask ? 110 : 78,
    startVelocity: isFinalTask ? 48 : 34
  });

  if (isFinalTask) {
    window.setTimeout(() => {
      confetti({
        ...baseConfig,
        particleCount: 140,
        spread: 125,
        startVelocity: 42,
        origin: { x: 0.22, y: 0.68 }
      });
      confetti({
        ...baseConfig,
        particleCount: 140,
        spread: 125,
        startVelocity: 42,
        origin: { x: 0.78, y: 0.68 }
      });
    }, 120);
  }
}

function getArchiveDates() {
  const today = getTodayKey();
  return Object.keys(state.tasksByDate)
    .filter((date) => date < today && state.tasksByDate[date].length > 0)
    .sort((a, b) => b.localeCompare(a));
}

function getSelectedTasks() {
  return state.tasksByDate[state.selectedDate] || [];
}

function ensureDateEntry(date) {
  if (!state.tasksByDate[date]) {
    state.tasksByDate[date] = [];
  }
}

function applyTheme(theme) {
  state.theme = theme;
  elements.body.dataset.theme = theme;
  syncThemeChips();
}

function syncThemeChips() {
  elements.themeChips.forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.themeTarget === state.theme);
  });
}

function syncRangeButtons() {
  elements.rangeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.range === currentRange);
  });
}

function syncCodingRangeButtons() {
  elements.codingRangeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.codeRange === currentCodingRange);
  });
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return cloneDefaultState();
    return {
      ...cloneDefaultState(),
      ...parsed,
      tasksByDate: parsed.tasksByDate && typeof parsed.tasksByDate === "object" ? parsed.tasksByDate : {},
      codingPracticeByDate: parsed.codingPracticeByDate && typeof parsed.codingPracticeByDate === "object" ? parsed.codingPracticeByDate : {}
    };
  } catch {
    return cloneDefaultState();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function formatMediumDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short"
  }).format(new Date(`${date}T00:00:00`));
}

function getTodayKey() {
  return formatISODate(new Date());
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateHash(date) {
  return date.split("-").reduce((sum, part) => sum + Number(part), 0);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}
