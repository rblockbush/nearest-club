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
  hintBtn: document.getElementById("hint-btn"),
  input: document.getElementById("guess-input"),
  suggestions: document.getElementById("suggestions"),
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

// --- Autocomplete -------------------------------------------------------
let matches = []; // club objects currently shown as suggestions
let activeIndex = -1; // highlighted suggestion, -1 = none

function showSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return hideSuggestions();

  matches = CLUBS.filter((c) => c.name.toLowerCase().includes(q))
    .sort((a, b) => {
      // names starting with the query come first, then alphabetical
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  if (matches.length === 0) return hideSuggestions();

  activeIndex = -1;
  el.suggestions.innerHTML = matches
    .map((c, i) => `<li role="option" data-index="${i}">${c.name}</li>`)
    .join("");
  el.suggestions.classList.remove("hidden");
  el.input.setAttribute("aria-expanded", "true");
}

function hideSuggestions() {
  el.suggestions.classList.add("hidden");
  el.suggestions.innerHTML = "";
  el.input.setAttribute("aria-expanded", "false");
  matches = [];
  activeIndex = -1;
}

function setActive(index) {
  activeIndex = index;
  [...el.suggestions.children].forEach((li, i) =>
    li.classList.toggle("active", i === activeIndex)
  );
  if (activeIndex >= 0) {
    el.suggestions.children[activeIndex].scrollIntoView({ block: "nearest" });
  }
}

function pickSuggestion(index) {
  if (index < 0 || index >= matches.length) return;
  el.input.value = matches[index].name;
  hideSuggestions();
  el.input.focus();
}

// --- Scoreboard ---------------------------------------------------------
function renderScoreboard() {
  el.played.textContent = stats.played;
  el.correct.textContent = stats.correct;
  el.accuracy.textContent =
    stats.played === 0 ? "0%" : Math.round((stats.correct / stats.played) * 100) + "%";
  el.streak.textContent = stats.streak;
  el.best.textContent = stats.best;
}

// --- Rounds -------------------------------------------------------------
function newRound() {
  currentTown = TOWNS[Math.floor(Math.random() * TOWNS.length)];
  roundOver = false;

  el.townName.textContent = currentTown.name;
  el.townCounty.textContent = "";
  el.townCounty.classList.add("hidden");
  el.hintBtn.classList.remove("hidden"); // county is a hint, hidden until asked for

  el.input.value = "";
  el.input.disabled = false;
  el.guessBtn.disabled = false;
  el.message.textContent = "";
  el.result.className = "result hidden";
  el.result.innerHTML = "";
  el.nextBtn.classList.add("hidden");
  hideSuggestions();
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
  const round = (n) => n.toFixed(1);

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

  // Build result
  let html = `<h3><span class="verdict ${isCorrect ? "correct" : "wrong"}">${
    isCorrect ? "✅ Correct!" : "❌ Not quite"
  }</span></h3>`;
  html += `<p>The nearest club to <strong>${currentTown.name}</strong> is
    <strong>${nearest.club.name}</strong> (${nearest.club.stadium}),
    about <strong>${round(nearest.dist)} miles</strong> away.</p>`;

  if (!isCorrect) {
    // Show the closest clubs so the player can see what they missed.
    const topCount = Math.min(5, Math.max(3, guessRank + 1));
    html += `<p>Closest clubs:</p><ol class="closest-list">`;
    ranked.slice(0, topCount).forEach((r) => {
      const isPick = r.club.name === guessed.name;
      html += `<li${isPick ? ' class="your-pick"' : ""}>${r.club.name} — ${round(
        r.dist
      )} mi${isPick ? " (your pick)" : ""}</li>`;
    });
    html += `</ol>`;

    if (guessRank + 1 > topCount) {
      // Pick fell outside the list above — call it out separately.
      html += `<p>Your pick, <strong>${guessed.name}</strong>, was only the
        <strong>${ordinal(guessRank + 1)} nearest</strong> —
        about ${round(guessDist)} miles away.</p>`;
    }
    html += `<p>That's <strong>${round(guessDist - nearest.dist)} miles</strong>
      further than the closest club.</p>`;
  } else {
    // On a correct guess, show the next two nearest clubs.
    html += `<p>Next nearest:</p><ol class="closest-list" start="2">`;
    ranked.slice(1, 3).forEach((r) => {
      html += `<li>${r.club.name} — ${round(r.dist)} mi</li>`;
    });
    html += `</ol>`;
  }

  el.result.className = "result " + (isCorrect ? "correct" : "wrong");
  el.result.innerHTML = html;

  el.message.textContent = "";
  el.input.disabled = true;
  el.guessBtn.disabled = true;
  hideSuggestions();
  el.nextBtn.classList.remove("hidden");
  el.nextBtn.focus(); // Enter now starts the next round
  roundOver = true;
}

// --- Wiring -------------------------------------------------------------
function init() {
  el.guessBtn.addEventListener("click", submitGuess);
  el.nextBtn.addEventListener("click", newRound);

  el.hintBtn.addEventListener("click", () => {
    el.townCounty.textContent = currentTown.county;
    el.townCounty.classList.remove("hidden");
    el.hintBtn.classList.add("hidden");
  });

  // Auto-suggest as the player types.
  el.input.addEventListener("input", () => {
    el.message.textContent = "";
    showSuggestions(el.input.value);
  });

  el.input.addEventListener("keydown", (e) => {
    const open = !el.suggestions.classList.contains("hidden");

    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((activeIndex + 1) % matches.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((activeIndex - 1 + matches.length) % matches.length);
    } else if (e.key === "Escape") {
      hideSuggestions();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0) {
        pickSuggestion(activeIndex);
      } else {
        hideSuggestions();
        submitGuess();
      }
    }
  });

  // mousedown (not click) so selection beats the input's blur event.
  el.suggestions.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    e.preventDefault();
    pickSuggestion(Number(li.dataset.index));
  });

  el.input.addEventListener("blur", () => {
    setTimeout(hideSuggestions, 150);
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
