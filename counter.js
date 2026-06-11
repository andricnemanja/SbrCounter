// ─── SIMULATION MODE ───────────────────────────────────────────────
// Postavi na true da testiras animaciju bez API poziva.
// Postavi na false da koristis pravi API.
const SIMULATION_MODE = true;

const SIM_START = 100;
const SIM_END = 1250;
const SIM_STEP = 7;
const SIM_DELAY = 1500;
// ───────────────────────────────────────────────────────────────────

// ─── BOOST KONFIGURACIJA ───────────────────────────────────────────
// Ako u BOOST_START_TIME brojac nije dostigao BOOST_THRESHOLD,
// krece postepeno uvecavanje ka BOOST_TARGET_VALUE do BOOST_END_TIME.
const BOOST_ENABLED = true;

const BOOST_START_TIME = { h: 0, m: 3 }; // kada pocinje boost
const BOOST_END_TIME = { h: 0, m: 6 }; // kada boost mora da dostigne cilj
const BOOST_THRESHOLD = 750; // ispod ove vrednosti boost se aktivira
const BOOST_TARGET_VALUE = 1073; // vrednost koju treba dostici do END_TIME
const BOOST_TICK_MS = 1500; // koliko cesto se azurira tokom boosta
// ───────────────────────────────────────────────────────────────────

const API_URL =
  "https://events.raceresult.com/api/presenter/window?eventid=405205&name=Finishers&key=71FvK2LpJqDK&lang=&screen=0&index=0";
const MULTIPLIER = 0.4652;
const FETCH_INTERVAL = 5000;

let currentDisplayedValue = null;
let lastKnownValue = 0;
let slots = [];
let simValue = SIM_START;

let boostActive = false;
let boostInterval = null;
let boostStartValue = 0;
let boostStartMs = 0;
let boostEndMs = 0;

// ─── HELPERS ───────────────────────────────────────────────────────

function timeToMs(h, m) {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h,
    m,
    0,
    0,
  ).getTime();
}

function nowMs() {
  return Date.now();
}

function computeValue(raw) {
  return Math.ceil(raw * MULTIPLIER);
}

// ─── RENDERING ─────────────────────────────────────────────────────

function buildSlots(digitCount) {
  const wrap = document.getElementById("counter-wrap");
  wrap.innerHTML = "";
  slots = [];

  for (let i = 0; i < digitCount; i++) {
    const slotEl = document.createElement("div");
    slotEl.className = "digit-slot";

    const reelEl = document.createElement("div");
    reelEl.className = "digit-reel";

    for (let d = 0; d <= 9; d++) {
      const span = document.createElement("span");
      span.textContent = d;
      reelEl.appendChild(span);
    }

    slotEl.appendChild(reelEl);
    wrap.appendChild(slotEl);
    slots.push(reelEl);
  }
}

function setDigit(reelEl, digit, animate) {
  reelEl.style.transition = animate
    ? "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    : "none";
  reelEl.style.transform = `translateY(-${digit * 190}px)`;
}

function displayNumber(value, animate) {
  const digits = String(value).split("").map(Number);

  if (slots.length !== digits.length) {
    buildSlots(digits.length);
    animate = false;
  }

  digits.forEach((d, i) => setDigit(slots[i], d, animate));
  currentDisplayedValue = value;
}

// ─── BOOST LOGIKA ──────────────────────────────────────────────────

function boostTick() {
  const now = nowMs();

  if (now >= boostEndMs) {
    // Boost gotov — prikazi ciljnu vrednost i zaustavi
    displayNumber(BOOST_TARGET_VALUE, true);
    stopBoost();
    return;
  }

  const progress = (now - boostStartMs) / (boostEndMs - boostStartMs);
  const eased =
    progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2; // ease in-out quad

  const interpolated = Math.ceil(
    boostStartValue + (BOOST_TARGET_VALUE - boostStartValue) * eased,
  );

  if (interpolated !== currentDisplayedValue) {
    displayNumber(interpolated, true);
  }
}

function startBoost() {
  if (boostActive) return;
  boostActive = true;
  boostStartValue = currentDisplayedValue ?? 0;
  boostStartMs = nowMs();
  boostEndMs = timeToMs(BOOST_END_TIME.h, BOOST_END_TIME.m);
  console.log(
    `[Boost] Startovan od ${boostStartValue} ka ${BOOST_TARGET_VALUE}`,
  );
  boostTick();
  boostInterval = setInterval(boostTick, BOOST_TICK_MS);
}

function stopBoost() {
  boostActive = false;
  if (boostInterval) {
    clearInterval(boostInterval);
    boostInterval = null;
  }
  console.log("[Boost] Zavrsen.");
}

function checkBoostCondition() {
  if (!BOOST_ENABLED || boostActive) return;

  const now = nowMs();
  const startMs = timeToMs(BOOST_START_TIME.h, BOOST_START_TIME.m);
  const endMs = timeToMs(BOOST_END_TIME.h, BOOST_END_TIME.m);

  const inWindow = now >= startMs && now < endMs;
  const belowThreshold = (currentDisplayedValue ?? 0) < BOOST_THRESHOLD;

  if (inWindow && belowThreshold) {
    startBoost();
  }
}

// ─── API FETCH ─────────────────────────────────────────────────────

async function fetchAndUpdate() {
  // Tokom aktivnog boosta ne prepisujemo vrednost sa API-ja
  if (boostActive) return;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Network response not ok");
    const data = await res.json();

    const row = Array.isArray(data)
      ? data[1]
      : (data[1] ?? Object.values(data)[1]);
    const rawValue = Array.isArray(row)
      ? row[1][1]
      : row != null
        ? Object.values(row)[1][1]
        : null;

    if (!rawValue || isNaN(rawValue)) return;

    const computed = computeValue(rawValue);
    if (
      computed !== currentDisplayedValue &&
      computed > (currentDisplayedValue ?? 0)
    ) {
      lastKnownValue = computed;
      displayNumber(computed, currentDisplayedValue !== null);
    }
  } catch (e) {
    console.warn("Fetch error:", e);
  }

  checkBoostCondition();
}

// ─── SIMULACIJA ────────────────────────────────────────────────────

function simulateStep() {
  if (!boostActive) {
    if (simValue !== currentDisplayedValue) {
      displayNumber(simValue, currentDisplayedValue !== null);
      lastKnownValue = simValue;
    }
    simValue = simValue + SIM_STEP > SIM_END ? SIM_START : simValue + SIM_STEP;
  }
  checkBoostCondition();
}

// ─── START ─────────────────────────────────────────────────────────

if (SIMULATION_MODE) {
  simulateStep();
  setInterval(simulateStep, SIM_DELAY);
} else {
  fetchAndUpdate();
  setInterval(fetchAndUpdate, FETCH_INTERVAL);
}
