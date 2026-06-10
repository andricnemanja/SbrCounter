// ─── SIMULATION MODE ───────────────────────────────────────────────
// Postavi na true da testiras animaciju bez API poziva.
// Postavi na false da koristis pravi API.
const SIMULATION_MODE = true;

const SIM_START  = 100;   // pocetna vrednost simulacije
const SIM_END    = 999;   // krajnja vrednost simulacije
const SIM_STEP   = 7;     // za koliko se povecava svaki korak
const SIM_DELAY  = 1500;  // ms izmedju koraka
// ───────────────────────────────────────────────────────────────────

const API_URL =
  "https://events.raceresult.com/api/presenter/window?eventid=405205&name=Finishers&key=71FvK2LpJqDK&lang=&screen=0&index=0";
const MULTIPLIER = 0.4652;
const FETCH_INTERVAL = 5000;

let currentDisplayedValue = null;
let lastKnownValue = 0;
let slots = [];
let simValue = SIM_START;

function computeValue(raw) {
  return Math.ceil(raw * MULTIPLIER);
}

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
  if (!animate) {
    reelEl.style.transition = "none";
  } else {
    reelEl.style.transition =
      "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  }
  reelEl.style.transform = `translateY(-${digit * 190}px)`;
}

function displayNumber(value, animate) {
  const digits = String(value).split("").map(Number);

  if (slots.length !== digits.length) {
    buildSlots(digits.length);
    animate = false;
  }

  digits.forEach((d, i) => {
    setDigit(slots[i], d, animate);
  });

  currentDisplayedValue = value;
}

async function fetchAndUpdate() {
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
    if (
      rawValue === 0 ||
      rawValue === null ||
      rawValue === undefined ||
      isNaN(rawValue)
    ) {
      return;
    }

    const computed = computeValue(rawValue);

    if (computed !== currentDisplayedValue) {
      lastKnownValue = computed;
      displayNumber(computed, currentDisplayedValue !== null);
    }
  } catch (e) {
    console.warn("Fetch error:", e);
  }
}

function simulateStep() {
  if (simValue !== currentDisplayedValue) {
    displayNumber(simValue, currentDisplayedValue !== null);
  }
  simValue = simValue + SIM_STEP > SIM_END ? SIM_START : simValue + SIM_STEP;
}

if (SIMULATION_MODE) {
  simulateStep();
  setInterval(simulateStep, SIM_DELAY);
} else {
  fetchAndUpdate();
  setInterval(fetchAndUpdate, FETCH_INTERVAL);
}
