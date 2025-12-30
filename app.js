console.log("APP JS LOADED");

/* ================= GLOBAL STATE ================= */
let runs = 0, wickets = 0, balls = 0, overs = 0;
let strikerIndex = 0;
let bowler = "";
let thisOver = [];

let batsmen = [
  { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 },
  { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }
];

let historyStack = [];
let thisOverDiv = null;

/* Match rules */
let playersPerTeam = 11;
let maxOvers = null;
let lastManRuleEnabled = false;

/* Innings */
let innings = 1;
let target = null;
let innings1Overs = [];
let innings1Runs = [];

let innings2Overs = [];
let innings2Runs = [];

let wormChart = null;


/* ================= DOM CACHE ================= */
const scoreTab = document.getElementById("scoreTab");
const analysisTab = document.getElementById("analysisTab");

/* ================= SAFE DOM ================= */
function ensureThisOverDiv() {
  if (!thisOverDiv) {
    thisOverDiv = document.getElementById("thisOver");
  }
}

/* ================= HELPERS ================= */
function batsmenLeft() {
  return playersPerTeam - wickets;
}

function lastManStanding() {
  return lastManRuleEnabled && batsmenLeft() === 1;
}

/* ================= UNDO ================= */
function saveState() {
  historyStack.push(JSON.stringify({
    runs, wickets, balls, overs, strikerIndex, bowler, innings,
    batsmen: JSON.parse(JSON.stringify(batsmen)),
    thisOver: [...thisOver]
  }));
}

function undo() {
  if (!historyStack.length) return;

  const s = JSON.parse(historyStack.pop());
  runs = s.runs;
  wickets = s.wickets;
  balls = s.balls;
  overs = s.overs;
  strikerIndex = s.strikerIndex;
  bowler = s.bowler;
  innings = s.innings;
  batsmen = s.batsmen;
  thisOver = s.thisOver;

  updateUI();
}

/* ================= MATCH SETUP ================= */
function toggleTest() {
  if (isTest.checked) {
    oversInput.disabled = true;
    oversInput.value = "";
  } else {
    oversInput.disabled = false;
    oversInput.value = 16;
  }
}

function toggleExtras(type) {
  if (type === "wide") noball.checked = false;
  if (type === "noball") wide.checked = false;
}

function startMatch() {
  if (!host.value.trim() || !visitor.value.trim()) {
    alert("Enter both team names");
    return;
  }

  playersPerTeam = parseInt(playersInput.value);
  if (!playersPerTeam || playersPerTeam < 2) {
    alert("Invalid players per team");
    return;
  }

  lastManRuleEnabled = lastManStanding?.checked || false;

  if (!isTest.checked) {
    maxOvers = parseInt(oversInput.value);
    if (!maxOvers || maxOvers <= 0) {
      alert("Invalid overs");
      return;
    }
  } else {
    maxOvers = null;
  }

  const toss = document.querySelector('input[name="toss"]:checked').value;
  const opt = document.querySelector('input[name="opt"]:checked').value;

  const batTeam =
    toss === "host"
      ? (opt === "bat" ? host.value : visitor.value)
      : (opt === "bat" ? visitor.value : host.value);

  const bowlTeam = batTeam === host.value ? visitor.value : host.value;

  pageTitle.innerText = `${batTeam} vs ${bowlTeam}`;

  newMatch.classList.add("hidden");
  match.classList.remove("hidden");
  startSetup.classList.remove("hidden");
}

/* ================= INNINGS START ================= */
function confirmStart() {
  if (!startStriker.value || !startNonStriker.value || !startBowler.value) {
    alert("Fill all fields");
    return;
  }

  batsmen[0].name = startStriker.value;
  batsmen[1].name = startNonStriker.value;
  bowler = startBowler.value;

  strikerIndex = 0; // FIXED

  startSetup.classList.add("hidden");
  updateUI();
}

/* ================= SCORING ================= */
function addRun(r) {
  saveState();
  ensureThisOverDiv();

  const bat = batsmen[strikerIndex];

  if (wide.checked) {
    runs++;
    thisOver.push("WD");
    wide.checked = false;
    updateUI();
    return;
  }

  if (noball.checked) {
    runs += 1 + r;
    bat.runs += r;
    thisOver.push("NB");
    noball.checked = false;
    updateUI();
    return;
  }

  balls++;
  bat.balls++;
  bat.runs += r;
  runs += r;

  if (r === 4) bat.fours++;
  if (r === 6) bat.sixes++;

  thisOver.push(
    r === 0 ? "0" :
    r === 4 ? "4" :
    r === 6 ? "6" : String(r)
  );

  if (r % 2 === 1 && !lastManStanding()) {
    swapStrike();
  }
  // CHASE COMPLETE
if (innings === 2 && target !== null && runs >= target) {
  alert("Match Complete\nBatting team won");
  saveMatch();
  return;
}


  if (balls === 6) endOver();
  updateUI();
}

/* ================= WICKET ================= */
function openWicket() {
  if (wide.checked || noball.checked) {
    alert("No wicket on Wide / No Ball");
    return;
  }
  wicketOverlay.classList.remove("hidden");
}

function confirmWicket() {
  saveState();

  wickets++;
  balls++;
  thisOver.push("W");

  wicketOverlay.classList.add("hidden");

  /* ================= LAST MAN STANDING MODE ================= */
  if (lastManRuleEnabled) {

    // If last man ALSO got out → innings ends
    if (wickets === playersPerTeam) {
      endInnings();
      return;
    }

    // If only one batsman left → he continues alone
    if (batsmenLeft() === 1) {
      updateUI();
      return;
    }
  }

  /* ================= NORMAL MODE ================= */
  if (!lastManRuleEnabled && wickets === playersPerTeam - 1) {
    endInnings();
    return;
  }

  /* ================= NEW BATSMAN ================= */
  const name = prompt("New batsman name");
  if (!name) {
    // Undo wicket if cancelled
    wickets--;
    balls--;
    thisOver.pop();
    return;
  }

  batsmen[strikerIndex] = {
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0
  };

  if (balls === 6) endOver();
  updateUI();
}



/* ================= RETIRE ================= */
function retireBatsman() {
  saveState();

  const name = prompt("New batsman (retired hurt)");
  if (!name) return;

  batsmen[strikerIndex] = {
    name, runs: 0, balls: 0, fours: 0, sixes: 0
  };

  updateUI();
}

/* ================= OVER ================= */
function endOver() {
  balls = 0;
  overs++;

  if (innings === 1) {
    innings1Overs.push(overs);
    innings1Runs.push(runs);
  } else {
    innings2Overs.push(overs);
    innings2Runs.push(runs);
  }

  drawWormChart();

  if (maxOvers !== null && overs >= maxOvers) {
    endInnings();
    return;
  }

  if (!lastManStanding()) swapStrike();
  bowler = prompt("New Bowler", bowler) || bowler;
  thisOver = [];
}


/* ================= INNINGS ================= */
function endInnings() {
  if (innings === 1) {
    target = runs + 1;
    innings = 2;
    alert("Target: " + target);
    resetInnings();
    startSetup.classList.remove("hidden");
  } else {
    alert("Match Complete");
    saveMatch();
  }
}

function resetInnings() {
  runs = wickets = balls = overs = 0;
  strikerIndex = 0;
  thisOver = [];
  batsmen = [
    { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 },
    { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }
  ];
  if (innings === 2) {
  innings2Overs = [];
  innings2Runs = [];
}

  updateUI();
}

/* ================= UI ================= */
function swapStrike() {
  if (lastManStanding()) return;
  strikerIndex = 1 - strikerIndex;
}

function manualSwap() {
  swapStrike();
  updateUI();
}

function updateUI() {
  ensureThisOverDiv();
  if (!thisOverDiv) return;

  oversText.innerText = `${overs}.${balls} overs`;
  scoreText.innerText = `${runs} - ${wickets}`;
  crr.innerText = overs ? (runs / overs).toFixed(2) : "0.00";

  bowlerName.innerText = bowler || "-";
  bowlerOver.innerText = `${overs}.${balls}`;

  const s = batsmen[strikerIndex];
  const n = batsmen[1 - strikerIndex];

  bat1Name.innerText = s.name + "*";
  bat2Name.innerText = n.name;

  bat1Runs.innerText = s.runs;
  bat1Balls.innerText = s.balls;
  bat1SR.innerText = s.balls ? ((s.runs / s.balls) * 100).toFixed(2) : "0.00";

  bat2Runs.innerText = n.runs;
  bat2Balls.innerText = n.balls;
  bat2SR.innerText = n.balls ? ((n.runs / n.balls) * 100).toFixed(2) : "0.00";

  thisOverDiv.innerHTML = "";
  thisOver.forEach(b => {
    const x = document.createElement("span");
    x.innerText = b;
    x.className =
      b === "W"  ? "ball-W"  :
      b === "WD" ? "ball-WD" :
      b === "NB" ? "ball-NB" :
      b === "4"  ? "ball-4"  :
      b === "6"  ? "ball-6"  : "ball-0";
    thisOverDiv.appendChild(x);
  });
  if (lastManStanding()) {
  bat2Name.innerText = "—";
  bat2Runs.innerText = "-";
  bat2Balls.innerText = "-";
  bat2SR.innerText = "-";
}

}

/* ================= TABS ================= */
function showTab(tab) {
  scoreTab.classList.add("hidden");
  analysisTab.classList.add("hidden");

  if (tab === "score") scoreTab.classList.remove("hidden");
  if (tab === "analysis") analysisTab.classList.remove("hidden");
}

/* ================= HISTORY ================= */
function saveMatch() {
  const h = JSON.parse(localStorage.getItem("history") || "[]");
  h.push(`${pageTitle.innerText} – ${runs}/${wickets}`);
  localStorage.setItem("history", JSON.stringify(h));
}
function drawWormChart() {
  const ctx = document.getElementById("wormChart");
  if (!ctx) return;

  if (wormChart) wormChart.destroy();

  wormChart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Innings 1",
          data: innings1Overs.map((o, i) => ({
            x: o,
            y: innings1Runs[i]
          })),
          borderColor: "#90caf9",
          backgroundColor: "#90caf9",
          tension: 0.35,
          pointRadius: 3
        },
        {
          label: "Innings 2",
          data: innings2Overs.map((o, i) => ({
            x: o,
            y: innings2Runs[i]
          })),
          borderColor: "#66bb6a",
          backgroundColor: "#66bb6a",
          tension: 0.35,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Overs" },
          ticks: { stepSize: 5 }
        },
        y: {
          title: { display: true, text: "Runs" },
          beginAtZero: true
        }
      }
    }
  });
}

