"use strict";
const $ = id => document.getElementById(id);
const saveKey = "ckmyapps.golf.round.v1";
const settingsKey = "ckmyapps.golf.settings.v1";
const menuMusic = new Audio("./audio/menu.wav");
const effects = {swing: new Audio("./audio/swing.wav"), cup: new Audio("./audio/cup.wav")};
menuMusic.loop = true;
menuMusic.volume = .34;
for (const effect of Object.values(effects)) effect.volume = .55;

function storageIssue() {
  $("storage-note").hidden = false;
  $("storage-note").textContent = "Browser storage is unavailable. Progress will last until this tab closes.";
}
function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch (error) {
    if (!(error instanceof SyntaxError)) storageIssue();
    return null;
  }
}
function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch (_) { storageIssue(); }
}
const prefs = read(settingsKey);
$("sounds").checked = prefs?.sounds !== false;
$("music").checked = prefs?.music !== false;
let round = read(saveKey);
if (!Golf.valid(round)) round = null;
let screen = "menu";
let interacted = false;

function syncMusic() {
  const inMenu = ["menu", "setup", "settings"].includes(screen);
  if (interacted && $("music").checked && inMenu && !document.hidden) {
    menuMusic.play().catch(() => {});
  } else {
    menuMusic.pause();
  }
}
for (const id of ["sounds", "music"]) {
  $(id).addEventListener("change", () => {
    save(settingsKey, {sounds: $("sounds").checked, music: $("music").checked});
    syncMusic();
  });
}
for (const event of ["pointerup", "keydown"]) {
  document.addEventListener(event, () => { interacted = true; syncMusic(); }, {once: true});
}
document.addEventListener("visibilitychange", syncMusic);

function show(next) {
  screen = next;
  for (const section of document.querySelectorAll("main > section")) section.hidden = section.id !== next;
  if (next === "play") renderPlay();
  if (next === "scorecard") renderScore();
  if (next === "menu") $("load").disabled = !round;
  document.getElementById(next).querySelector("h1, h2").focus({preventScroll: true});
  window.scrollTo(0, 0);
  syncMusic();
}
for (const button of document.querySelectorAll("[data-screen]")) {
  button.addEventListener("click", () => show(button.dataset.screen));
}
$("load").disabled = !round;
$("load").onclick = () => {
  setShot();
  show(Golf.finished(round) ? "scorecard" : "play");
};
$("handicap").oninput = () => { $("handicap-value").value = $("handicap").value; };
$("setup-form").onsubmit = event => {
  event.preventDefault();
  if (round && !Golf.finished(round) && !window.confirm("Replace your saved round?")) return;
  round = Golf.fresh(Number($("handicap").value), $("weakness").value);
  save(saveKey, round);
  setShot();
  show("play");
};

function setShot() {
  const green = Golf.onGreen(round);
  const choices = green ? ["Putter"] : Object.keys(Golf.clubs).slice(0, -1);
  $("club").replaceChildren(...choices.map(name => new Option(name)));
  $("club").value = Golf.recommended(round);
  $("aim").value = 0;
  $("power").value = round.strokes === 0 ? 75
    : Math.min(100, Math.max(1, Math.round(Golf.distance(round) / Golf.clubs[$("club").value] * 100)));
}
for (const id of ["club", "aim", "power"]) $(id).addEventListener("input", updateControls);
$("swing").onclick = () => {
  const ended = Golf.swing(round, $("club").value, Number($("power").value), Number($("aim").value));
  if ($("sounds").checked) {
    const sound = effects[ended && !round.message.startsWith("Stroke limit") ? "cup" : "swing"];
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
  save(saveKey, round);
  setShot();
  if (Golf.finished(round)) show("scorecard");
  else {
    renderPlay();
    if (ended) $("next").focus();
  }
};
$("next").onclick = () => {
  round.pending = false;
  round.message = Golf.opening;
  save(saveKey, round);
  renderPlay();
  $("club").focus();
};
$("score-back").onclick = () => show(Golf.finished(round) ? "menu" : "play");

function renderPlay() {
  const number = round.scores.length + (round.pending ? 0 : 1);
  const shown = Golf.holes[number - 1];
  $("hole-title").textContent = "Hole " + String(number).padStart(2, "0")
    + " · Par " + shown.par + " · " + shown.yards + " yds";
  $("shot-status").textContent = round.pending ? "Hole complete" : "Stroke " + (round.strokes + 1)
    + " · " + (Golf.onGreen(round) ? Math.round(Golf.distance(round) * 3) + " ft"
      : Math.round(Golf.distance(round)) + " yds") + " to pin";
  $("message").textContent = round.message;
  $("shot-controls").hidden = round.pending;
  $("next").hidden = !round.pending;
  $("swing").textContent = Golf.onGreen(round) ? "Putt" : "Swing";
  updateControls();
}

function updateControls() {
  $("power-value").value = $("power").value + "%";
  $("aim-value").value = $("aim").value + "°";
  drawCourse();
}

function renderScore() {
  const total = Golf.totals(round);
  const difference = total.strokes - total.par;
  const relative = difference === 0 ? "E" : difference > 0 ? "+" + difference : difference;
  $("score-title").textContent = Golf.finished(round) ? "Round Complete" : "Scorecard";
  $("round-score").textContent = total.strokes + " strokes · " + relative;
  $("score-back").textContent = Golf.finished(round) ? "Main Menu" : "Back to Round";
  $("scores").replaceChildren(...Golf.holes.map((hole, index) => {
    const row = document.createElement("tr");
    for (const value of [index + 1, hole.par, round.scores[index] ?? "–"]) row.insertCell().textContent = value;
    return row;
  }));
}

function drawCourse() {
  const canvas = $("course");
  const ctx = canvas.getContext("2d");
  const {width, height} = canvas;
  ctx.clearRect(0, 0, width, height);
  const index = round.scores.length - Number(round.pending);
  const hole = Golf.holes[index];
  const green = !round.pending && Golf.onGreen(round);
  const low = green ? hole.yards - 22 : -60;
  const high = green ? hole.yards + 22 : hole.yards + 70;
  const scale = green ? 56 : 210;
  const point = (forward, lateral) => [
    width * (.5 + lateral / scale), height * (1 - (forward - low) / (high - low))
  ];
  function glyph(symbol, forward, lateral, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#72f7b4";
    ctx.font = "22px monospace";
    ctx.textAlign = "center";
    ctx.fillText(symbol, ...point(forward, lateral));
    ctx.globalAlpha = 1;
  }
  if (!green) {
    const marks = {2:"^", 3:"▲", 4:"·", 5:"∷", 6:"≈", 7:"×"};
    for (const side of [-1, 1]) {
      const symbol = marks[side < 0 ? hole.left : hole.right];
      for (let row = 1; symbol && row <= 3; row++) glyph(symbol, hole.yards * row / 4, side * (48 + row % 2 * 9), .7);
    }
    glyph("∷", hole.yards - 34, 27, .7);
  }
  const [pinX, pinY] = point(hole.yards, 0);
  ctx.fillStyle = "#72f7b4";
  ctx.fillRect(pinX - 9, pinY, 18, 3);
  ctx.fillRect(pinX - 1, pinY - 30, 3, 32);
  ctx.beginPath();
  ctx.moveTo(pinX, pinY - 30);
  ctx.lineTo(pinX + 18, pinY - 22);
  ctx.lineTo(pinX, pinY - 14);
  ctx.fill();
  if (round.pending) return;
  const angle = Golf.heading(round) + Number($("aim").value) * Math.PI / 180;
  const length = Golf.clubs[$("club").value] * Number($("power").value) / 100;
  for (let index = 1; index <= 7; index++) {
    const step = length * index / 7;
    const [x, y] = point(round.forward + Math.cos(angle) * step, round.lateral + Math.sin(angle) * step);
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  ctx.beginPath();
  ctx.fillStyle = "#fff";
  ctx.arc(...point(round.forward, round.lateral), 6, 0, Math.PI * 2);
  ctx.fill();
}
