const labels = Array.from(document.querySelectorAll(".label"));
const zones = Array.from(document.querySelectorAll(".drop-zone"));
const scoreEl = document.getElementById("score");
const totalEl = document.getElementById("total");
const attemptsEl = document.getElementById("attempts");
const resetButton = document.getElementById("resetButton");
const statusMessage = document.getElementById("statusMessage");

let score = 0;
let attempts = 0;
let activeDrag = null;
let selectedByKeyboard = null;
const DROP_ZONE_HIT_SLOP = 22;

const total = zones.length;
if (totalEl) {
  totalEl.textContent = String(total);
}

labels.forEach((label) => {
  label.dataset.originParent = "labelsContainer";
  label.dataset.originNext = "";

  label.addEventListener("pointerdown", onPointerDown);
  label.addEventListener("keydown", onKeyboardAction);
});

zones.forEach((zone) => {
  zone.addEventListener("keydown", onKeyboardZoneAction);
  zone.tabIndex = 0;
});

if (resetButton) {
  resetButton.addEventListener("click", resetGame);
}

function onPointerDown(event) {
  const target = event.currentTarget;
  if (target.classList.contains("locked")) {
    return;
  }

  event.preventDefault();
  target.setPointerCapture(event.pointerId);

  const rect = target.getBoundingClientRect();
  activeDrag = {
    label: target,
    pointerId: event.pointerId,
    startParent: target.parentElement,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };

  target.classList.add("dragging");
  target.style.position = "fixed";
  target.style.width = `${rect.width}px`;
  target.style.left = `${rect.left}px`;
  target.style.top = `${rect.top}px`;

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const { label, offsetX, offsetY } = activeDrag;
  label.style.left = `${event.clientX - offsetX}px`;
  label.style.top = `${event.clientY - offsetY}px`;

  highlightCurrentZone(event.clientX, event.clientY);
}

function onPointerUp(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const { label } = activeDrag;
  const zone = zoneFromPoint(event.clientX, event.clientY, label);

  clearZoneHighlights();

  if (zone) {
    attemptDrop(label, zone);
  } else {
    restoreLabelToTray(label);
    setStatus("Drop a label onto one of the diagram targets.", "");
  }

  label.classList.remove("dragging");
  label.style.position = "";
  label.style.left = "";
  label.style.top = "";
  label.style.width = "";

  activeDrag = null;
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
}

function zoneFromPoint(x, y, ignoreElement) {
  let originalVisibility = "";
  if (ignoreElement) {
    originalVisibility = ignoreElement.style.visibility;
    ignoreElement.style.visibility = "hidden";
  }

  const element = document.elementFromPoint(x, y);

  if (ignoreElement) {
    ignoreElement.style.visibility = originalVisibility;
  }

  if (element) {
    const directZone = element.closest(".drop-zone");
    if (directZone) {
      return directZone;
    }
  }

  // Fallback: allow drops slightly outside the visual zone for easier mobile use.
  return zones.find((zone) => {
    const rect = zone.getBoundingClientRect();
    return (
      x >= rect.left - DROP_ZONE_HIT_SLOP &&
      x <= rect.right + DROP_ZONE_HIT_SLOP &&
      y >= rect.top - DROP_ZONE_HIT_SLOP &&
      y <= rect.bottom + DROP_ZONE_HIT_SLOP
    );
  }) || null;
}

function highlightCurrentZone(x, y) {
  const zone = zoneFromPoint(x, y, activeDrag ? activeDrag.label : null);
  clearZoneHighlights();
  if (zone) {
    zone.classList.add("wrong");
  }
}

function clearZoneHighlights() {
  zones.forEach((zone) => {
    if (!zone.classList.contains("correct")) {
      zone.classList.remove("wrong");
    }
  });
}

function attemptDrop(label, zone) {
  if (zone.classList.contains("correct")) {
    restoreLabelToTray(label);
    setStatus("That target is already labeled.", "error");
    return;
  }

  attempts += 1;
  if (attemptsEl) {
    attemptsEl.textContent = String(attempts);
  }

  const picked = label.dataset.label;
  const expected = zone.dataset.slot;

  if (picked === expected) {
    zone.classList.remove("wrong");
    zone.classList.add("correct");
    zone.textContent = label.textContent;

    label.classList.add("locked");
    label.setAttribute("aria-disabled", "true");
    label.disabled = true;

    score += 1;
    if (scoreEl) {
      scoreEl.textContent = String(score);
    }

    setStatus(`Correct: ${label.textContent} matched!`, "success");

    if (score === total) {
      setStatus("Excellent work. You labeled all microbes correctly.", "success");
    }
    return;
  }

  zone.classList.add("wrong");
  restoreLabelToTray(label);
  setStatus(`Not quite. ${label.textContent} does not match this microbe.`, "error");
}

function restoreLabelToTray(label) {
  if (label.classList.contains("locked")) {
    return;
  }
  const tray = document.getElementById("labelsContainer");
  tray.appendChild(label);
}

function setStatus(message, tone) {
  if (!statusMessage) {
    return;
  }
  statusMessage.textContent = message;
  statusMessage.style.color = tone === "error" ? "#b00020" : "#165f53";
}

function resetGame() {
  score = 0;
  attempts = 0;
  selectedByKeyboard = null;
  if (scoreEl) {
    scoreEl.textContent = "0";
  }
  if (attemptsEl) {
    attemptsEl.textContent = "0";
  }

  const tray = document.getElementById("labelsContainer");

  labels.forEach((label) => {
    label.classList.remove("locked", "dragging");
    label.disabled = false;
    label.removeAttribute("aria-disabled");
    label.style.position = "";
    label.style.left = "";
    label.style.top = "";
    label.style.width = "";
    tray.appendChild(label);
  });

  zones.forEach((zone) => {
    zone.classList.remove("correct", "wrong");
    zone.textContent = zone.dataset.placeholder || "Drop label here";
  });

  setStatus("Simulation reset. Try labeling each microbe again.", "");
}

function onKeyboardAction(event) {
  const label = event.currentTarget;
  if (label.classList.contains("locked")) {
    return;
  }

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    selectedByKeyboard = label;
    setStatus(`Selected ${label.textContent}. Tab to a drop zone and press Enter.`, "");
  }
}

function onKeyboardZoneAction(event) {
  if (!selectedByKeyboard || selectedByKeyboard.classList.contains("locked")) {
    return;
  }

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    const zone = event.currentTarget;
    attemptDrop(selectedByKeyboard, zone);
    selectedByKeyboard = null;
  }
}

const functionMatchSections = Array.from(document.querySelectorAll(".function-match[data-match]"));

functionMatchSections.forEach((section) => {
  const selects = Array.from(section.querySelectorAll(".function-select"));
  const scoreEl = section.querySelector(".function-match-score");
  const totalEl = section.querySelector(".function-match-total");
  const statusEl = section.querySelector(".function-match-status");
  const checkButton = section.querySelector(".check-function-match");
  const resetButton = section.querySelector(".reset-function-match");

  if (!scoreEl || !totalEl || !statusEl || !checkButton || !resetButton) {
    return;
  }

  totalEl.textContent = String(selects.length);
  scoreEl.textContent = "0";

  selects.forEach(shuffleSelectOptions);

  checkButton.addEventListener("click", () => {
    let correctCount = 0;

    selects.forEach((select) => {
      const row = select.closest("tr");
      const expected = select.dataset.answer;
      const chosen = select.value;

      select.classList.remove("correct", "wrong");
      if (row) {
        row.classList.remove("match-correct", "match-wrong");
      }

      if (!chosen) {
        return;
      }

      if (chosen === expected) {
        select.classList.add("correct");
        if (row) {
          row.classList.add("match-correct");
        }
        correctCount += 1;
      } else {
        select.classList.add("wrong");
        if (row) {
          row.classList.add("match-wrong");
        }
      }
    });

    scoreEl.textContent = String(correctCount);

    if (correctCount === selects.length) {
      statusEl.textContent = "Excellent: all component-function pairs are correct.";
      statusEl.style.color = "#165f53";
      return;
    }

    statusEl.textContent = `You have ${correctCount}/${selects.length} correct. Review highlighted rows and try again.`;
    statusEl.style.color = "#7a271a";
  });

  resetButton.addEventListener("click", () => {
    selects.forEach((select) => {
      const row = select.closest("tr");
      select.value = "";
      select.classList.remove("correct", "wrong");
      if (row) {
        row.classList.remove("match-correct", "match-wrong");
      }
      shuffleSelectOptions(select);
    });

    scoreEl.textContent = "0";
    statusEl.textContent = "Matching reset. Choose functions for each component.";
    statusEl.style.color = "#165f53";
  });

  selects.forEach((select) => {
    select.addEventListener("change", () => {
      const row = select.closest("tr");
      select.classList.remove("correct", "wrong");
      if (row) {
        row.classList.remove("match-correct", "match-wrong");
      }
    });
  });
});

function shuffleSelectOptions(select) {
  const options = Array.from(select.options);
  if (options.length <= 2) {
    return;
  }

  const placeholder = options[0];
  const answerOptions = options.slice(1);

  for (let i = answerOptions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [answerOptions[i], answerOptions[j]] = [answerOptions[j], answerOptions[i]];
  }

  select.replaceChildren(placeholder, ...answerOptions);
  select.value = "";
}
