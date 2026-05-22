"use strict";

// --- Persistent score ---------------------------------------------------
const STORAGE_KEY = "nearestClub.stats.v1";

function defaultStats() {
  return { played: 0, correct: 0, streak: 0, best: 0 };
}

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === "object" ? { ...defaultStats(), ...saved } : defaultStats();
  } catch {
    return defaultStats();
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* localStorage unavailable — score just won't persist */
  }
}

// --- Geometry -----------------------------------------------------------
// Great-circle distance between two {lat, lng} points, in miles.
function haversineMiles(a, b) {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Clubs sorted nearest-first for a given town.
function rankClubs(town) {
  return CLUBS.map((club) => ({ club, dist: haversineMiles(town, club) })).sort(
    (a, b) => a.dist - b.dist
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- DOM ----------------------------------------------------------------
const el = {
  townName: document.getElementById("town-name"),
  townCounty: document.getElementById("town-county"),
  input: document.getElementById("guess-input"),
  datalist: document.getElementById("club-list"),
  guessBtn: document.getElementById("guess-btn"),
  nextBtn: document.getElementById("next-btn"),
  message: document.getElementById("message"),
  result: document.getElementById("result"),
  resetBtn: document.getElementById("reset-btn"),
  played: document.getElementById("stat-played"),
  correct: document.getElementById("stat-correct"),
  accuracy: document.getElementById("stat-accuracy"),
  streak: document.getElementById("stat-streak"),
  best: document.getElementById("stat-best"),
};

// --- Game state ---------------------------------------------------------
let stats = loadStats();
let currentTown = null;
let roundOver = false;

function clubByName(name) {
  const wanted = name.trim().toLowerCase();
  return CLUBS.find((c) => c.name.toLowerCase() === wanted) || null;
}

function renderScoreboard() {
  el.played.textContent = stats.played;
  el.correct.textContent = stats.correct;
  el.accuracy.textContent =
    stats.played === 0 ? "0%" : Math.round((stats.correct / stats.played) * 100) + "%";
  el.streak.textContent = stats.streak;
  el.best.textContent = stats.best;
}

function newRound() {
  currentTown = TOWNS[Math.floor(Math.random() * TOWNS.length)];
  roundOver = false;

  el.townName.textContent = currentTown.name;
  el.townCounty.textContent = currentTown.county;
  el.input.value = "";
  el.input.disabled = false;
  el.guessBtn.disabled = false;
  el.message.textContent = "";
  el.result.className = "result hidden";
  el.result.innerHTML = "";
  el.nextBtn.classList.add("hidden");
  el.input.focus();
}

function submitGuess() {
  if (roundOver) return;

  const guessed = clubByName(el.input.value);
  if (!guessed) {
    el.message.textContent = "Please pick a club from the list.";
    return;
  }

  const ranked = rankClubs(currentTown);
  const nearest = ranked[0];
  const guessRank = ranked.findIndex((r) => r.club.name === guessed.name);
  const guessDist = ranked[guessRank].dist;
  const isCorrect = guessRank === 0;

  // Update score
  stats.played += 1;
  if (isCorrect) {
    stats.correct += 1;
    stats.streak += 1;
    stats.best = Math.max(stats.best, stats.streak);
  } else {
    stats.streak = 0;
  }
  saveStats();
  renderScoreboard();

  // Render result
  const round = (n) => n.toFixed(1);
  let html = `<h3><span class="verdict ${isCorrect ? "correct" : "wrong"}">${
    isCorrect ? "✅ Correct!" : "❌ Not quite"
  }</span></h3>`;
  html += `<p>Nearest club to <strong>${currentTown.name}</strong> is
    <strong>${nearest.club.name}</strong> (${nearest.club.stadium}),
    about <strong>${round(nearest.dist)} miles</strong> away.</p>`;
  if (!isCorrect) {
    html += `<p>Your pick, <strong>${guessed.name}</strong>, was the
      <strong>${ordinal(guessRank + 1)} nearest</strong> —
      about ${round(guessDist)} miles away
      (${round(guessDist - nearest.dist)} miles further than the closest).</p>`;
  }
  el.result.className = "result " + (isCorrect ? "correct" : "wrong");
  el.result.innerHTML = html;

  el.message.textContent = "";
  el.input.disabled = true;
  el.guessBtn.disabled = true;
  el.nextBtn.classList.remove("hidden");
  roundOver = true;
}

// --- Wiring -------------------------------------------------------------
function init() {
  // Populate the searchable dropdown (alphabetical for easy scanning).
  [...CLUBS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((club) => {
      const opt = document.createElement("option");
      opt.value = club.name;
      el.datalist.appendChild(opt);
    });

  el.guessBtn.addEventListener("click", submitGuess);
  el.nextBtn.addEventListener("click", newRound);

  el.input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (roundOver) newRound();
    else submitGuess();
  });

  el.resetBtn.addEventListener("click", () => {
    stats = defaultStats();
    saveStats();
    renderScoreboard();
  });

  renderScoreboard();
  newRound();
}

init();
