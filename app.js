/* ============================================================
   Visual Studio für iPad – komplette IDE-Logik
   ============================================================ */
"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ---------- Projektzustand ---------- */
const STORE_KEY = "vsiPad.project.v1";
const PREF_KEY = "vsiPad.prefs.v1";

const DEMO = {
  "index.html":
`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meine App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Hallo vom iPad! 👋</h1>
  <button id="klick">Klick mich</button>
  <p id="ausgabe"></p>
  <script src="script.js"><\/script>
</body>
</html>`,
  "style.css":
`body {
  font-family: -apple-system, sans-serif;
  background: linear-gradient(135deg, #68217a, #007acc);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
}
button {
  font-size: 18px;
  padding: 12px 28px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
}`,
  "script.js":
`const zaehler = 0;

document.getElementById("klick").addEventListener("click", () => {
  console.log("Geklickt!");
  document.getElementById("ausgabe").textContent = "Geklickt um " + new Date().toLocaleTimeString("de-DE");
});

console.log("App gestartet ✓");`,
  "README.md":
`# Mein Projekt

Erstellt in **Visual Studio für iPad**.
`,
};

let files = loadProject();
let prefs = loadPrefs();
let openTabs = Object.keys(files).slice(0, 3);
let activeFile = openTabs[0] || null;
let activeRibbonTab = "Datei";
let activePanel = "output";
let previewOn = false;
let dirty = false;

function loadProject() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const p = JSON.parse(raw); if (p && typeof p === "object") return p; }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEMO));
}
function saveProject() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(files)); } catch (e) {}
  setDirty(false);
}
function loadPrefs() {
  try { return Object.assign({ theme: "dark", fontSize: 14, wrap: false, numbers: true }, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); }
  catch (e) { return { theme: "dark", fontSize: 14, wrap: false, numbers: true }; }
}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} }

function setDirty(d) {
  dirty = d;
  $("#status-left").textContent = (d ? "● Ungespeicherte Änderungen" : "Bereit") + " – " + activeFile;
}

/* ---------- Icons je Dateityp ---------- */
function iconFor(name) {
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".css")) return "🎨";
  if (name.endsWith(".js")) return "📜";
  if (name.endsWith(".json")) return "🔧";
  if (name.endsWith(".md")) return "📘";
  return "📄";
}
function langFor(name) {
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".js")) return "js";
  return "text";
}

/* ============================================================
   Syntax-Highlighting (leichtgewichtig, ohne Abhängigkeiten)
   ============================================================ */
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

const JS_KW = "const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|typeof|instanceof|in|of|try|catch|finally|throw|async|await|yield|import|export|from|default|delete|void|null|undefined|true|false|static|get|set";

function hlJS(src) {
  const re = new RegExp(
    "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)" +
    "|(`(?:\\\\.|[^`\\\\])*`|\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*')" +
    "|\\b(" + JS_KW + ")\\b" +
    "|\\b(\\d+(?:\\.\\d+)?)\\b" +
    "|([A-Za-z_$][\\w$]*)(?=\\s*\\()",
    "g");
  return esc(src).replace(re, (m, com, str, kw, num, fn) => {
    if (com) return `<span class="tk-com">${com}</span>`;
    if (str) return `<span class="tk-str">${str}</span>`;
    if (kw) return `<span class="tk-kw">${kw}</span>`;
    if (num) return `<span class="tk-num">${num}</span>`;
    if (fn) return `<span class="tk-fn">${fn}</span>`;
    return m;
  });
}

function hlCSS(src) {
  const re = /(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(@[\w-]+)|([#.]?[A-Za-z_][\w-]*)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr)?)|([{}])/g;
  let inBlock = false;
  return esc(src).replace(re, (m, com, str, at, prop, num, brace) => {
    if (com) return `<span class="tk-com">${com}</span>`;
    if (str) return `<span class="tk-str">${str}</span>`;
    if (at) return `<span class="tk-at">${at}</span>`;
    if (prop) {
      if (brace) return m;
      return inBlock ? `<span class="tk-attr">${prop}</span>` : `<span class="tk-sel">${prop}</span>`;
    }
    if (num) return `<span class="tk-num">${num}</span>`;
    if (brace === "{") { inBlock = true; return m; }
    if (brace === "}") { inBlock = false; return m; }
    return m;
  });
}

function hlHTML(src) {
  return esc(src).replace(
    /(&lt;!--[\s\S]*?--&gt;)|(&lt;!DOCTYPE[^&]*&gt;)|(&lt;\/?)([a-zA-Z][\w-]*)((?:[^&]|&(?!gt;))*?)(\/?&gt;)/g,
    (m, com, dt, open, tag, attrs, close) => {
      if (com) return `<span class="tk-com">${com}</span>`;
      if (dt) return `<span class="tk-com">${dt}</span>`;
      const attrsHl = attrs.replace(/([\w-]+)(=)("[^"]*"|'[^']*')?/g, (a, name, eq, val) => {
        return `<span class="tk-attr">${name}</span>${eq || ""}${val ? `<span class="tk-str">${val}</span>` : ""}`;
      });
      return `${open}<span class="tk-tag">${tag}</span>${attrsHl}${close}`;
    });
}

function highlight(src, lang) {
  if (lang === "js") return hlJS(src);
  if (lang === "css") return hlCSS(src);
  if (lang === "html") return hlHTML(src);
  return esc(src);
}

/* ============================================================
   Editor
   ============================================================ */
const editor = $("#editor");
const hlPre = $("#highlight");
const gutter = $("#gutter");

function refreshEditor() {
  const lang = activeFile ? langFor(activeFile) : "text";
  const val = editor.value;
  hlPre.innerHTML = highlight(val, lang) + "\n";
  if (prefs.numbers && !prefs.wrap) {
    const n = val.split("\n").length;
    let g = "";
    for (let i = 1; i <= n; i++) g += i + "\n";
    gutter.textContent = g;
    gutter.style.display = "block";
    $("#editor-wrap").style.setProperty("--gut", "60px");
  } else {
    gutter.textContent = "";
    gutter.style.display = "none";
  }
  editor.style.whiteSpace = prefs.wrap ? "pre-wrap" : "pre";
  hlPre.style.whiteSpace = prefs.wrap ? "pre-wrap" : "pre";
  editor.setAttribute("wrap", prefs.wrap ? "soft" : "off");
  editor.style.fontSize = prefs.fontSize + "px";
  hlPre.style.fontSize = prefs.fontSize + "px";
  gutter.style.fontSize = prefs.fontSize + "px";
  gutter.style.lineHeight = window.getComputedStyle(editor).lineHeight;
  updateStatusPos();
}

editor.addEventListener("input", () => {
  refreshEditor();
  setDirty(true);
  clearTimeout(editor._t);
  editor._t = setTimeout(saveProject, 800);
});
editor.addEventListener("scroll", () => {
  hlPre.scrollTop = editor.scrollTop;
  hlPre.scrollLeft = editor.scrollLeft;
  gutter.scrollTop = editor.scrollTop;
});
editor.addEventListener("keyup", updateStatusPos);
editor.addEventListener("click", updateStatusPos);

function updateStatusPos() {
  const pos = editor.selectionStart;
  const upto = editor.value.slice(0, pos);
  const line = upto.split("\n").length;
  const col = pos - upto.lastIndexOf("\n");
  $("#status-right").textContent = `Zn ${line}, Sp ${col}   |   ${prefs.fontSize}px   |   ${Object.keys(files).length} Dateien`;
}

/* ============================================================
   Tabs & Dateibaum
   ============================================================ */
function renderTabs() {
  const tabs = $("#tabs");
  tabs.innerHTML = "";
  openTabs.forEach((name) => {
    const t = document.createElement("div");
    t.className = "tab" + (name === activeFile ? " on" : "");
    t.innerHTML = `<span>${iconFor(name)}</span><span>${esc(name)}</span><button class="t-close" title="Schließen">✕</button>`;
    t.addEventListener("click", (e) => {
      if (e.target.classList.contains("t-close")) { closeTab(name); return; }
      openFile(name);
    });
    tabs.appendChild(t);
  });
}

function renderTree() {
  const tree = $("#filetree");
  tree.innerHTML = "";
  Object.keys(files).sort().forEach((name) => {
    const row = document.createElement("div");
    row.className = "file-row" + (name === activeFile ? " on" : "");
    row.innerHTML = `<span class="f-ic">${iconFor(name)}</span><span class="f-name">${esc(name)}</span>`;
    row.addEventListener("click", () => openFile(name));
    tree.appendChild(row);
  });
  $("#status-right").textContent = "";
  updateStatusPos();
}

function openFile(name) {
  if (!files[name]) return;
  if (!openTabs.includes(name)) openTabs.push(name);
  activeFile = name;
  editor.value = files[name];
  setDirty(false);
  renderTabs(); renderTree(); refreshEditor();
}

function closeTab(name) {
  openTabs = openTabs.filter((f) => f !== name);
  if (activeFile === name) activeFile = openTabs[openTabs.length - 1] || null;
  if (activeFile) openFile(activeFile);
  else { editor.value = ""; renderTabs(); refreshEditor(); }
}

/* ============================================================
   Modal (iPad-freundlicher Dialog statt prompt())
   ============================================================ */
function askText(title, def) {
  return new Promise((resolve) => {
    $("#modal-title").textContent = title;
    $("#modal-input").classList.remove("hidden");
    $("#modal-body").classList.add("hidden");
    $("#modal-input").value = def || "";
    $("#modal-overlay").classList.remove("hidden");
    const inp = $("#modal-input");
    setTimeout(() => inp.focus(), 50);
    const done = (v) => {
      $("#modal-overlay").classList.add("hidden");
      $("#modal-ok").onclick = $("#modal-cancel").onclick = null;
      resolve(v);
    };
    $("#modal-ok").onclick = () => done(inp.value.trim());
    $("#modal-cancel").onclick = () => done(null);
    inp.onkeydown = (e) => { if (e.key === "Enter") done(inp.value.trim()); };
  });
}

function showInfo(title, html) {
  $("#modal-title").textContent = title;
  $("#modal-input").classList.add("hidden");
  $("#modal-body").classList.remove("hidden");
  $("#modal-body").innerHTML = html;
  $("#modal-cancel").textContent = "Schließen";
  $("#modal-ok").classList.add("hidden");
  $("#modal-overlay").classList.remove("hidden");
  $("#modal-cancel").onclick = () => {
    $("#modal-overlay").classList.add("hidden");
    $("#modal-ok").classList.remove("hidden");
    $("#modal-cancel").textContent = "Abbrechen";
  };
}

/* ============================================================
   Dateioperationen
   ============================================================ */
async function cmdNewFile() {
  const name = await askText("Neue Datei (z. B. seite.html, app.js, stil.css):", "");
  if (!name) return;
  if (files[name] !== undefined) { logOut(`⚠ Datei "${name}" existiert bereits.`, "warn"); return; }
  const ext = name.split(".").pop();
  const tpl = {
    html: `<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8" />\n  <title>Neue Seite</title>\n</head>\n<body>\n\n</body>\n</html>`,
    css: `/* ${name} */\n`,
    js: `"use strict";\n\n`,
    json: `{\n  \n}\n`,
    md: `# ${name.replace(/\.md$/, "")}\n`,
  };
  files[name] = tpl[ext] !== undefined ? tpl[ext] : "";
  saveProject(); openFile(name);
  logOut(`✔ Datei "${name}" erstellt.`, "sys");
}

async function cmdRename() {
  if (!activeFile) return;
  const name = await askText(`Datei umbenennen: "${activeFile}" →`, activeFile);
  if (!name || name === activeFile) return;
  if (files[name] !== undefined) { logOut(`⚠ Datei "${name}" existiert bereits.`, "warn"); return; }
  files[name] = files[activeFile];
  delete files[activeFile];
  openTabs = openTabs.map((f) => (f === activeFile ? name : f));
  saveProject(); openFile(name);
  logOut(`✔ Umbenannt in "${name}".`, "sys");
}

function cmdDelete() {
  if (!activeFile) return;
  askText(`Datei löschen – zum Bestätigen Namen eingeben:`, activeFile).then((c) => {
    if (c !== activeFile) return;
    delete files[activeFile];
    const gone = activeFile;
    openTabs = openTabs.filter((f) => f !== gone);
    activeFile = openTabs[openTabs.length - 1] || Object.keys(files)[0] || null;
    saveProject();
    if (activeFile) openFile(activeFile); else { editor.value = ""; renderTabs(); renderTree(); refreshEditor(); }
    logOut(`✔ Datei "${gone}" gelöscht.`, "sys");
  });
}

function cmdSave() {
  if (!activeFile) return;
  files[activeFile] = editor.value;
  saveProject();
  logOut(`✔ "${activeFile}" gespeichert.`, "sys");
  statusFlash("Gespeichert ✓");
}
function cmdSaveAll() {
  if (activeFile) files[activeFile] = editor.value;
  saveProject();
  logOut("✔ Alle Dateien gespeichert.", "sys");
  statusFlash("Alles gespeichert ✓");
}

function statusFlash(msg) {
  const el = $("#status-left");
  const old = el.textContent;
  el.textContent = msg;
  setTimeout(() => { el.textContent = dirty ? "● Ungespeicherte Änderungen – " + activeFile : "Bereit – " + activeFile; }, 1500);
}

/* Export / Import */
function cmdExport() {
  const blob = new Blob([JSON.stringify(files, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "projekt.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  logOut("✔ Projekt als projekt.json exportiert.", "sys");
}
function cmdImport() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(r.result);
        if (p && typeof p === "object") { files = p; openTabs = Object.keys(files).slice(0, 3); saveProject(); openFile(activeFile = openTabs[0]); logOut("✔ Projekt importiert.", "sys"); }
      } catch (e) { logOut("✘ Import fehlgeschlagen: " + e.message, "error"); }
    };
    r.readAsText(f);
  };
  inp.click();
}

/* ============================================================
   Bearbeiten
   ============================================================ */
function execEdit(cmd) {
  editor.focus();
  try { document.execCommand(cmd); } catch (e) {}
  refreshEditor();
  setDirty(true);
}
async function cmdPaste() {
  editor.focus();
  try {
    const t = await navigator.clipboard.readText();
    if (t) {
      const s = editor.selectionStart, epos = editor.selectionEnd;
      editor.setRangeText(t, s, epos, "end");
      refreshEditor(); setDirty(true);
    }
  } catch (e) { logOut("⚠ Zwischenablage blockiert – bitte per Berührung einfügen (lange drücken → Einfügen).", "warn"); }
}

let findPos = -1;
function findNext(back) {
  const q = $("#find-input").value;
  if (!q || !activeFile) return;
  const val = editor.value;
  if (back) {
    const before = val.lastIndexOf(q, Math.max(0, findPos - 1));
    findPos = before;
  } else {
    const from = findPos < 0 ? 0 : findPos + 1;
    let idx = val.indexOf(q, from);
    if (idx < 0) idx = val.indexOf(q, 0);
    findPos = idx;
  }
  if (findPos < 0) { statusFlash("Nicht gefunden"); return; }
  editor.focus();
  editor.setSelectionRange(findPos, findPos + q.length);
  const line = val.slice(0, findPos).split("\n").length;
  editor.scrollTop = (line - 4) * parseFloat(getComputedStyle(editor).lineHeight || 21);
  hlPre.scrollTop = editor.scrollTop;
}
function replaceOne() {
  const q = $("#find-input").value, r = $("#replace-input").value;
  if (q && findPos >= 0 && editor.value.substr(findPos, q.length) === q) {
    editor.setRangeText(r, findPos, findPos + q.length, "end");
    refreshEditor(); setDirty(true);
  }
  findNext(false);
}
function replaceAll() {
  const q = $("#find-input").value, r = $("#replace-input").value;
  if (!q) return;
  const n = editor.value.split(q).length - 1;
  editor.value = editor.value.split(q).join(r);
  refreshEditor(); setDirty(true); saveProject();
  logOut(`✔ ${n} Vorkommen ersetzt.`, "sys");
}

/* ============================================================
   Ansicht
   ============================================================ */
function toggleExplorer() { $("#sidebar").classList.toggle("closed"); }
function togglePanel() { $("#panel").classList.toggle("collapsed"); }
function togglePreview() { $("#preview-col").classList.toggle("closed"); previewOn = !$("#preview-col").classList.contains("closed"); }
function zoom(d) {
  prefs.fontSize = Math.min(32, Math.max(9, prefs.fontSize + d));
  savePrefs(); refreshEditor();
}
function toggleWrap() { prefs.wrap = !prefs.wrap; savePrefs(); refreshEditor(); }
function toggleNumbers() { prefs.numbers = !prefs.numbers; savePrefs(); refreshEditor(); }
function toggleTheme() {
  prefs.theme = prefs.theme === "dark" ? "light" : "dark";
  document.body.classList.toggle("light", prefs.theme === "light");
  savePrefs();
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
}

/* ============================================================
   Erstellen (Lint/Build)
   ============================================================ */
function cmdBuild() {
  const errs = [];
  if (activeFile) files[activeFile] = editor.value;
  saveProject();
  for (const [name, code] of Object.entries(files)) {
    const lang = langFor(name);
    if (lang === "js") {
      try { new Function(code); }
      catch (e) { errs.push({ file: name, msg: "Syntaxfehler: " + e.message }); }
    } else if (lang === "css") {
      const bal = (code.match(/{/g) || []).length - (code.match(/}/g) || []).length;
      if (bal !== 0) errs.push({ file: name, msg: `Unausgeglichene geschweifte Klammern (${bal > 0 ? "fehlend: }" : "zu viel: }"})` });
    } else if (lang === "html") {
      if (!/<html[\s>]/i.test(code)) errs.push({ file: name, msg: "Kein <html>-Element gefunden" });
    }
  }
  showErrors(errs);
  switchPanel("errors");
  if (errs.length === 0) {
    $("#errors").innerHTML = `<div class="ok-line">✔ Erstellen erfolgreich: 0 Fehler, 0 Warnungen</div>`;
    logOut("✔ Build erfolgreich.", "sys");
  } else {
    logOut(`✘ Build fehlgeschlagen: ${errs.length} Fehler.`, "error");
  }
}

function showErrors(errs) {
  const box = $("#errors");
  box.innerHTML = "";
  errs.forEach((e) => {
    const d = document.createElement("div");
    d.className = "err-line";
    d.textContent = `✘ ${e.file}: ${e.msg}`;
    d.addEventListener("click", () => openFile(e.file));
    box.appendChild(d);
  });
}

/* ============================================================
   Ausführen / Vorschau
   ============================================================ */
function buildPreviewDoc() {
  let html = files["index.html"];
  if (html === undefined) {
    html = Object.keys(files).find((f) => f.endsWith(".html")) || "";
  }
  html = html.replace(/<link[^>]*href="([^"]+)"[^>]*>/g, (m, p) =>
    files[p] !== undefined ? `<style>\n${files[p]}\n</style>` : m);
  html = html.replace(/<script[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g, (m, p) =>
    files[p] !== undefined ? `<script>\n${files[p]}\n<\/script>` : m);
  const hook = `<script>(function(){
    var send=function(t,a){parent.postMessage({__vsi:1,type:t,args:a}, "*")};
    var fmt=function(x){try{return (typeof x==="object"&&x!==null)?JSON.stringify(x):String(x)}catch(e){return String(x)}};
    ["log","warn","error","info"].forEach(function(k){
      var o=console[k];
      console[k]=function(){send(k,[].map.call(arguments,fmt));o&&o.apply(console,arguments)};
    });
    window.onerror=function(m,s,l,c){send("error",[m+"  (Zeile "+l+")"])};
  })();<\/script>`;
  return html.includes("<head") ? html.replace(/<head([^>]*)>/i, `<head$1>${hook}`) : hook + html;
}

function cmdRun() {
  if (activeFile) files[activeFile] = editor.value;
  saveProject();
  const frame = $("#preview");
  frame.srcdoc = buildPreviewDoc();
  $("#preview-col").classList.remove("closed");
  previewOn = true;
  switchPanel("output");
  $("#panel").classList.remove("collapsed");
  logOut("▶ Gestartet (F5).", "info");
}
function cmdStop() {
  $("#preview").srcdoc = "";
  logOut("⏹ Gestoppt.", "info");
}

window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || d.__vsi !== 1) return;
  logOut(d.args.join(" "), d.type === "error" ? "error" : d.type === "warn" ? "warn" : d.type === "info" ? "info" : "");
});

function logOut(msg, cls) {
  const out = $("#output");
  const d = document.createElement("div");
  d.className = "log-line" + (cls ? " log-" + cls : "");
  d.textContent = msg;
  out.appendChild(d);
  out.scrollTop = out.scrollHeight;
  while (out.children.length > 400) out.removeChild(out.firstChild);
}

/* ============================================================
   Panel-Tabs
   ============================================================ */
function switchPanel(name) {
  activePanel = name;
  $$("#panel-tabs [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  $$("#panel-body .pane").forEach((p) => p.classList.toggle("on", p.id === name));
}

/* ============================================================
   Terminal
   ============================================================ */
const termLog = $("#term-log");
function termPrint(msg, cls) {
  const d = document.createElement("div");
  d.style.color = cls === "err" ? "var(--red)" : cls === "dim" ? "var(--fg-dim)" : "var(--fg)";
  d.textContent = msg;
  termLog.appendChild(d);
  termLog.scrollTop = termLog.scrollHeight;
}
const TERM_HELP = [
  "Verfügbare Terminal-Befehle:",
  "  help              diese Hilfe",
  "  ls                alle Dateien auflisten",
  "  cat <datei>       Dateiinhalt anzeigen",
  "  new <datei>       neue Datei erstellen",
  "  rm <datei>        Datei löschen",
  "  ren <alt> <neu>   Datei umbenennen",
  "  run               Projekt starten",
  "  build             Projekt erstellen/prüfen",
  "  clear             Ausgabe leeren",
  "  echo <text>       Text ausgeben",
  "  date              Datum/Uhrzeit",
  "  stat              Projektstatistik",
].join("\n");

function runTerminal(cmdline) {
  const [cmd, ...rest] = cmdline.trim().split(/\s+/);
  const arg = rest.join(" ");
  switch (cmd) {
    case "": break;
    case "help": termPrint(TERM_HELP, "dim"); break;
    case "ls": termPrint(Object.keys(files).sort().join("\n") || "(leer)"); break;
    case "cat": files[arg] !== undefined ? termPrint(files[arg]) : termPrint(`cat: ${arg}: nicht gefunden`, "err"); break;
    case "new":
      if (!arg) { termPrint("Verwendung: new <datei>", "err"); break; }
      if (files[arg] !== undefined) { termPrint("existiert bereits", "err"); break; }
      files[arg] = ""; saveProject(); renderTree(); termPrint(`✔ ${arg} erstellt`);
      break;
    case "rm":
      if (files[arg] === undefined) { termPrint("nicht gefunden", "err"); break; }
      delete files[arg]; saveProject(); renderTree(); termPrint(`✔ ${arg} gelöscht`);
      break;
    case "ren": {
      const [a, b] = rest;
      if (!a || !b || files[a] === undefined) { termPrint("Verwendung: ren <alt> <neu>", "err"); break; }
      files[b] = files[a]; delete files[a]; saveProject(); renderTree(); termPrint(`✔ ${a} → ${b}`);
      break;
    }
    case "run": cmdRun(); termPrint("▶ gestartet"); break;
    case "build": cmdBuild(); termPrint("✔ Build ausgeführt (siehe Fehlerliste)"); break;
    case "clear": termLog.innerHTML = ""; break;
    case "echo": termPrint(arg); break;
    case "date": termPrint(new Date().toLocaleString("de-DE")); break;
    case "stat": {
      const n = Object.keys(files).length;
      const lines = Object.values(files).reduce((a, c) => a + c.split("\n").length, 0);
      termPrint(`${n} Dateien, ${lines} Zeilen insgesamt`);
      break;
    }
    default: termPrint(`${cmd}: Befehl nicht gefunden – "help" eingeben`, "err");
  }
}
$("#term-input").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const v = e.target.value;
  termPrint("❯ " + v, "dim");
  runTerminal(v);
  e.target.value = "";
});

/* ============================================================
   Befehlsregistrierung – ALLE Funktionen an einem Ort
   ============================================================ */
const TAB_ORDER = ["Datei", "Bearbeiten", "Ansicht", "Projekt", "Erstellen", "Debuggen", "Tools", "Hilfe"];
const commands = [];
function reg(tab, id, label, icon, key, run) { commands.push({ tab, id, label, icon, key, run }); }

/* Datei */
reg("Datei", "new-file", "Neue Datei…", "📄", "", cmdNewFile);
reg("Datei", "save", "Speichern", "💾", "Strg+S", cmdSave);
reg("Datei", "save-all", "Alles speichern", "🗂", "Strg+Alt+S", cmdSaveAll);
reg("Datei", "rename", "Umbenennen…", "✏️", "F2", cmdRename);
reg("Datei", "delete", "Löschen…", "🗑", "", cmdDelete);
reg("Datei", "export", "Projekt exportieren", "⬇️", "", cmdExport);
reg("Datei", "import", "Projekt importieren…", "⬆️", "", cmdImport);
reg("Datei", "close-tab", "Registerkarte schließen", "✕", "", () => closeTab(activeFile));

/* Bearbeiten */
reg("Bearbeiten", "undo", "Rückgängig", "↩️", "Strg+Z", () => execEdit("undo"));
reg("Bearbeiten", "redo", "Wiederholen", "↪️", "Strg+Y", () => execEdit("redo"));
reg("Bearbeiten", "cut", "Ausschneiden", "✂️", "Strg+X", () => execEdit("cut"));
reg("Bearbeiten", "copy", "Kopieren", "📋", "Strg+C", () => execEdit("copy"));
reg("Bearbeiten", "paste", "Einfügen", "📌", "Strg+V", cmdPaste);
reg("Bearbeiten", "find", "Suchen und Ersetzen", "🔍", "Strg+F", () => { $("#findbar").classList.remove("hidden"); $("#find-input").focus(); });
reg("Bearbeiten", "select-all", "Alles auswählen", "⬚", "Strg+A", () => { editor.focus(); editor.select(); });

/* Ansicht */
reg("Ansicht", "explorer", "Projektmappen-Explorer", "🗂", "", toggleExplorer);
reg("Ansicht", "panel", "Ausgabefenster", "🖥", "", togglePanel);
reg("Ansicht", "preview", "Vorschau ein/aus", "👁", "", togglePreview);
reg("Ansicht", "terminal", "Terminal", "⌨️", "", () => { switchPanel("terminal"); $("#panel").classList.remove("collapsed"); $("#term-input").focus(); });
reg("Ansicht", "zoom-in", "Vergrößern", "➕", "Strg+Plus", () => zoom(1));
reg("Ansicht", "zoom-out", "Verkleinern", "➖", "Strg+Minus", () => zoom(-1));
reg("Ansicht", "zoom-reset", "Zoom zurücksetzen", "100%", "Strg+0", () => { prefs.fontSize = 14; savePrefs(); refreshEditor(); });
reg("Ansicht", "wrap", "Wortumbruch umschalten", "↵", "", toggleWrap);
reg("Ansicht", "numbers", "Zeilennummern umschalten", "#️⃣", "", toggleNumbers);
reg("Ansicht", "theme", "Design: Hell/Dunkel", "🌗", "", toggleTheme);
reg("Ansicht", "fullscreen", "Vollbild", "⛶", "", toggleFullscreen);

/* Projekt */
reg("Projekt", "new-file2", "Neue Datei…", "📄", "", cmdNewFile);
reg("Projekt", "stats", "Projektstatistik", "📊", "", () => {
  const n = Object.keys(files).length;
  const lines = Object.values(files).reduce((a, c) => a + c.split("\n").length, 0);
  const chars = Object.values(files).reduce((a, c) => a + c.length, 0);
  showInfo("Projektstatistik", `${n} Dateien<br>${lines} Zeilen<br>${chars} Zeichen`);
});
reg("Projekt", "reset", "Beispielprojekt wiederherstellen", "♻️", "", async () => {
  const c = await askText('Beispielprojekt wiederherstellen? "ja" eingeben:', "");
  if (c === "ja") { files = JSON.parse(JSON.stringify(DEMO)); openTabs = Object.keys(files).slice(0, 3); saveProject(); openFile("index.html"); }
});

/* Erstellen */
reg("Erstellen", "build", "Projektmappe erstellen", "🔨", "Strg+Umschalt+B", cmdBuild);
reg("Erstellen", "rebuild", "Projektmappe neu erstellen", "🏗", "", () => { $("#errors").innerHTML = ""; cmdBuild(); });

/* Debuggen */
reg("Debuggen", "run", "Starten", "▶️", "F5", cmdRun);
reg("Debuggen", "stop", "Debugging stoppen", "⏹", "Umschalt+F5", cmdStop);
reg("Debuggen", "reload", "Vorschau neu laden", "⟳", "", cmdRun);
reg("Debuggen", "clear-console", "Konsole leeren", "🧹", "Strg+L", () => { $("#output").innerHTML = ""; });

/* Tools */
reg("Tools", "palette", "Befehlspalette…", "⌘", "Strg+Umschalt+P", openPalette);
reg("Tools", "format", "Dokument formatieren", "✨", "Strg+K, Strg+D", cmdFormat);
reg("Tools", "shortcuts", "Tastaturkürzel", "⌨️", "", showShortcuts);

/* Hilfe */
reg("Hilfe", "help", "Hilfe", "❓", "F1", showShortcuts);
reg("Hilfe", "about", "Info", "ℹ️", "", () => showInfo("Info", "<b>Visual Studio für iPad</b><br>Eine komplette Web-IDE, optimiert für iPadOS.<br>Alle Befehle findest du in der Befehlspalette (Strg+Umschalt+P) und im Ribbon."));

/* Einfacher Formatierer (Klammereinzug für JS/CSS) */
function cmdFormat() {
  if (!activeFile) return;
  const lang = langFor(activeFile);
  if (lang !== "js" && lang !== "css") { statusFlash("Formatieren nur für JS/CSS"); return; }
  const src = editor.value;
  let depth = 0;
  const out = [];
  let line = "";
  let inStr = null, inCom = false, inBlockCom = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inBlockCom) { line += c; if (c === "*" && n === "/") { line += n; i++; inBlockCom = false; } continue; }
    if (inCom) { line += c; if (c === "\n") { out.push(line); line = ""; inCom = false; } continue; }
    if (inStr) { line += c; if (c === "\\") { line += n; i++; } else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; line += c; continue; }
    if (c === "/" && n === "/") { inCom = true; line += c; continue; }
    if (c === "/" && n === "*") { inBlockCom = true; line += c; continue; }
    if (c === "{" || c === "[" || c === "(") {
      line = line.trim();
      if (line) out.push("  ".repeat(depth) + line);
      out.push("  ".repeat(depth) + c);
      depth++; line = ""; continue;
    }
    if (c === "}" || c === "]" || c === ")") {
      if (line.trim()) out.push("  ".repeat(depth) + line.trim());
      depth = Math.max(0, depth - 1);
      out.push("  ".repeat(depth) + c);
      line = ""; continue;
    }
    if (c === ";") { out.push("  ".repeat(depth) + (line + c).trim()); line = ""; continue; }
    if (c === "\n") { if (line.trim()) out.push("  ".repeat(depth) + line.trim()); line = ""; continue; }
    line += c;
  }
  if (line.trim()) out.push("  ".repeat(depth) + line.trim());
  editor.value = out.join("\n");
  refreshEditor(); setDirty(true); saveProject();
  statusFlash("Formatiert ✓");
}

function showShortcuts() {
  const rows = commands.filter((c) => c.key).map((c) => `<tr><td style="padding:2px 12px 2px 0"><kbd>${c.key}</kbd></td><td>${c.icon} ${c.label}</td></tr>`).join("");
  showInfo("Tastaturkürzel", `<table>${rows}</table><br>💡 Tipp: Mit <kbd>Strg+Umschalt+P</kbd> öffnest du die Befehlspalette mit <b>allen</b> Funktionen.`);
}

/* ============================================================
   Ribbon rendern
   ============================================================ */
function renderRibbon() {
  const strip = $("#ribbon-tabs");
  strip.innerHTML = "";
  TAB_ORDER.forEach((t) => {
    const b = document.createElement("button");
    b.textContent = t;
    b.className = t === activeRibbonTab ? "on" : "";
    b.addEventListener("click", () => { activeRibbonTab = t; renderRibbon(); });
    strip.appendChild(b);
  });
  const bar = $("#ribbon");
  bar.innerHTML = "";
  commands.filter((c) => c.tab === activeRibbonTab).forEach((c, i, arr) => {
    const b = document.createElement("button");
    b.className = "ribbon-cmd";
    b.innerHTML = `<span class="ic">${c.icon}</span><span class="lbl">${c.label}</span>${c.key ? `<span class="key">${c.key}</span>` : ""}`;
    b.addEventListener("click", c.run);
    bar.appendChild(b);
    if (i < arr.length - 1 && (i + 1) % 6 === 0) {
      const sep = document.createElement("div");
      sep.className = "ribbon-sep";
      bar.appendChild(sep);
    }
  });
}

/* ============================================================
   Befehlspalette – ALLE Skills & Funktionen durchsuchbar
   ============================================================ */
let palSel = 0;
function openPalette() {
  $("#palette-overlay").classList.remove("hidden");
  const inp = $("#palette-input");
  inp.value = "";
  renderPalette("");
  setTimeout(() => inp.focus(), 50);
  palSel = 0;
}
function closePalette() { $("#palette-overlay").classList.add("hidden"); }

function renderPalette(q) {
  const list = $("#palette-list");
  const needle = q.trim().toLowerCase();
  const matches = commands.filter((c) => !needle || (c.label + " " + c.tab + " " + c.id).toLowerCase().includes(needle));
  list.innerHTML = "";
  matches.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "pal-item" + (i === palSel ? " sel" : "");
    d.innerHTML = `<span class="p-ic">${c.icon}</span><span>${c.label}</span>${c.key ? `<span class="p-key">${c.key}</span>` : ""}<span class="p-cat">${c.tab}</span>`;
    d.addEventListener("click", () => { closePalette(); c.run(); });
    list.appendChild(d);
  });
  if (matches.length === 0) list.innerHTML = `<div class="pal-empty">Kein Befehl gefunden</div>`;
}

$("#palette-input").addEventListener("input", (e) => { palSel = 0; renderPalette(e.target.value); });
$("#palette-input").addEventListener("keydown", (e) => {
  const items = $$("#palette-list .pal-item");
  if (e.key === "ArrowDown") { palSel = Math.min(items.length - 1, palSel + 1); renderPalette(e.target.value); scrollPal(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { palSel = Math.max(0, palSel - 1); renderPalette(e.target.value); scrollPal(); e.preventDefault(); }
  else if (e.key === "Enter") {
    const needle = e.target.value.trim().toLowerCase();
    const matches = commands.filter((c) => !needle || (c.label + " " + c.tab + " " + c.id).toLowerCase().includes(needle));
    if (matches[palSel]) { closePalette(); matches[palSel].run(); }
  } else if (e.key === "Escape") closePalette();
});
function scrollPal() {
  const el = $$("#palette-list .pal-item")[palSel];
  if (el) el.scrollIntoView({ block: "nearest" });
}
$("#palette-overlay").addEventListener("click", (e) => { if (e.target.id === "palette-overlay") closePalette(); });
$("#btn-palette").addEventListener("click", openPalette);

/* ============================================================
   Globale Tastenkürzel
   ============================================================ */
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  if (mod && e.shiftKey && k === "p") { e.preventDefault(); openPalette(); return; }
  if (mod && !e.shiftKey && k === "s") { e.preventDefault(); e.altKey ? cmdSaveAll() : cmdSave(); return; }
  if (mod && e.shiftKey && k === "b") { e.preventDefault(); cmdBuild(); return; }
  if (mod && !e.shiftKey && k === "f") { e.preventDefault(); $("#findbar").classList.remove("hidden"); $("#find-input").focus(); return; }
  if (mod && k === "l") { e.preventDefault(); $("#output").innerHTML = ""; return; }
  if (mod && k === "0") { e.preventDefault(); prefs.fontSize = 14; savePrefs(); refreshEditor(); return; }
  if (mod && (e.key === "+" || e.key === "=")) { e.preventDefault(); zoom(1); return; }
  if (mod && e.key === "-") { e.preventDefault(); zoom(-1); return; }
  if (e.key === "F5") { e.preventDefault(); e.shiftKey ? cmdStop() : cmdRun(); return; }
  if (e.key === "F1") { e.preventDefault(); showShortcuts(); return; }
  if (e.key === "F2") { e.preventDefault(); cmdRename(); return; }
  if (e.key === "Escape") {
    if (!$("#palette-overlay").classList.contains("hidden")) closePalette();
    else if (!$("#findbar").classList.contains("hidden")) $("#findbar").classList.add("hidden");
  }
});

/* ============================================================
   UI-Verdrahtung
   ============================================================ */
$("#btn-run").addEventListener("click", cmdRun);
$("#btn-stop").addEventListener("click", cmdStop);
$("#btn-explorer").addEventListener("click", toggleExplorer);
$("#fa-new").addEventListener("click", cmdNewFile);
$("#fa-rename").addEventListener("click", cmdRename);
$("#fa-delete").addEventListener("click", cmdDelete);
$("#pv-reload").addEventListener("click", cmdRun);
$("#pv-close").addEventListener("click", togglePreview);
$("#panel-clear").addEventListener("click", () => {
  if (activePanel === "output") $("#output").innerHTML = "";
  else if (activePanel === "errors") $("#errors").innerHTML = "";
  else termLog.innerHTML = "";
});
$("#panel-toggle").addEventListener("click", togglePanel);
$$("#panel-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => switchPanel(b.dataset.tab)));
$$("#device-picker button").forEach((b) => b.addEventListener("click", () => {
  $$("#device-picker button").forEach((x) => x.classList.remove("on"));
  b.classList.add("on");
  const f = $("#preview");
  f.classList.remove("w-mini", "w-ipadmini");
  if (b.dataset.w === "820px") f.classList.add("w-ipadmini");
  if (b.dataset.w === "480px") f.classList.add("w-mini");
}));

/* Suchleiste */
$("#find-next").addEventListener("click", () => findNext(false));
$("#find-prev").addEventListener("click", () => findNext(true));
$("#replace-one").addEventListener("click", replaceOne);
$("#replace-all").addEventListener("click", replaceAll);
$("#find-close").addEventListener("click", () => $("#findbar").classList.add("hidden"));
$("#find-input").addEventListener("keydown", (e) => { if (e.key === "Enter") findNext(e.shiftKey); });

/* ============================================================
   Start
   ============================================================ */
document.body.classList.toggle("light", prefs.theme === "light");
openFile(activeFile || Object.keys(files)[0]);
renderRibbon();
switchPanel("output");
logOut("Visual Studio für iPad bereit.", "sys");
logOut("💡 Alle Befehle: ⌘-Button oben rechts oder Strg+Umschalt+P. Terminal: help eingeben.", "sys");
refreshEditor();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
