const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

const state = {
  player: null,
  pin: null,
  authMode: "register",
  prediction: null,
  activeGroup: "A",
  scores: {},
  knockout: {},
  server: { predictions: [], ranking: [], results: {}, awards: {}, participants: [], pot: {} },
  avatar: "🐀",
  pendingPrediction: null
};

const GROUP_ORDER = Object.keys(WC_DATA.groups).sort();
const TEAM_FLAG_CODES = {
  "Mexico":"mx", "South Africa":"za", "Korea Republic":"kr", "Czechia":"cz",
  "Canada":"ca", "Switzerland":"ch", "Qatar":"qa", "Bosnia and Herzegovina":"ba",
  "Brazil":"br", "Morocco":"ma", "Haiti":"ht", "Scotland":"gb-sct",
  "United States":"us", "Paraguay":"py", "Australia":"au", "Türkiye":"tr",
  "Germany":"de", "Curaçao":"cw", "Côte d’Ivoire":"ci", "Ecuador":"ec",
  "Netherlands":"nl", "Japan":"jp", "Tunisia":"tn", "Sweden":"se",
  "Belgium":"be", "Egypt":"eg", "Iran":"ir", "New Zealand":"nz",
  "Spain":"es", "Cabo Verde":"cv", "Saudi Arabia":"sa", "Uruguay":"uy",
  "France":"fr", "Senegal":"sn", "Norway":"no", "Iraq":"iq",
  "Argentina":"ar", "Algeria":"dz", "Austria":"at", "Jordan":"jo",
  "Portugal":"pt", "Uzbekistan":"uz", "Colombia":"co", "Congo DR":"cd",
  "England":"gb-eng", "Croatia":"hr", "Ghana":"gh", "Panama":"pa"
};
const TEAM_DISPLAY = { "Korea Republic":"South Korea", "Czechia":"Czech Republic", "United States":"USA", "Congo DR":"DR Congo" };
const ROUND_LABELS = { r32:"DIECISEISAVOS", r16:"OCTAVOS", qf:"CUARTOS", sf:"SEMIS", final:"FINAL", champion:"CAMPEÓN" };

// Layout visual oficial del bracket.
// Importante: NO se pinta por rangos consecutivos, sino por IDs reales de partido.
// Así las líneas visuales respetan cruces como M73 + M75 -> M90.
const BRACKET_VISUAL_LAYOUT = {
  left: {
    r32: [73, 75, 74, 77, 83, 84, 81, 82],
    r16: [90, 89, 93, 94],
    qf: [97, 98],
    sf: [101]
  },
  right: {
    r32: [76, 78, 79, 80, 86, 88, 85, 87],
    r16: [91, 92, 95, 96],
    qf: [99, 100],
    sf: [102]
  }
};

function getSlotIndexById(round, id){
  const list = window.KNOCKOUT_SLOTS?.[round] || [];
  return list.findIndex(slot => Number(slot.id) === Number(id));
}


document.addEventListener("DOMContentLoaded", () => {
  enforceGate();
  renderForm();
  bindUI();
  updateStatus();
  renderCountdown();
  setInterval(renderCountdown, 60000);
});


function activateTab(tab){
  $$(".tabs button").forEach(b=>b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab-panel").forEach(p=>p.classList.toggle("active", p.id === "tab-" + tab));
  if (tab === "resumen") renderMySummary();
  if (tab === "estadisticas") renderGlobalStats();
  if (tab === "participantes") renderParticipants();
  if (tab === "mando") renderCommandCenter();
  if (tab === "impacto") renderLiveImpact();
  if (tab === "predicciones") renderFriendsPredictions();
}

function renderCountdown(){
  const el = $("#deadlineCountdown");
  if (!el) return;
  const diff = new Date(APP_CONFIG.EDIT_DEADLINE_ISO).getTime() - Date.now();
  if (diff <= 0) { el.textContent = "🔒 ExSys cerrado. Ya solo queda defender el forecast con dignidad."; return; }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  el.textContent = `⏳ Quedan ${days} días, ${hours} h y ${minutes} min`;
}




function enforceGate(){
  const params = new URLSearchParams(location.search);
  const key = params.get("clave");
  if (APP_CONFIG.ACCESS_KEY && key !== APP_CONFIG.ACCESS_KEY) {
    $("#gate").classList.remove("hidden");
    document.querySelector("header").classList.add("hidden");
    document.querySelector("main").classList.add("hidden");
    document.querySelector("footer").classList.add("hidden");
  }
}

function bindUI(){
  $("#loginBtn").addEventListener("click", login);
  $("#refreshBtn").addEventListener("click", refreshState);
  $("#predictionForm").addEventListener("submit", savePrediction);
  $("#saveDraftBtn")?.addEventListener("click", saveDraftLocal);
  $("#loadDraftBtn")?.addEventListener("click", loadDraftLocal);
  $("#summaryBtn")?.addEventListener("click", () => { renderMySummary(); activateTab("resumen"); });
  $("#nextIncompleteBtn")?.addEventListener("click", goToNextIncompleteGroup);
  $("#cancelReviewBtn")?.addEventListener("click", closeReviewModal);
  $("#confirmSaveBtn")?.addEventListener("click", confirmSavePrediction);
  $("#copyPredictionBtn")?.addEventListener("click", copyPredictionForWhatsApp);
  $("#randomRatBtn")?.addEventListener("click", randomRatPrediction);
  $$(".avatar-option").forEach(btn => btn.addEventListener("click", () => {
    state.avatar = btn.dataset.avatar || "🐀";
    localStorage.setItem("exsysAvatar", state.avatar);
    $$(".avatar-option").forEach(b=>b.classList.toggle("active", b.dataset.avatar === state.avatar));
  }));
  const savedAvatar = localStorage.getItem("exsysAvatar");
  if (savedAvatar) { state.avatar = savedAvatar; $$(".avatar-option").forEach(b=>b.classList.toggle("active", b.dataset.avatar === state.avatar)); }

  $$(".mode-card").forEach(btn => btn.addEventListener("click", () => setAuthMode(btn.dataset.mode)));

  $$(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab);
    });
  });

  $("#predictionForm").addEventListener("input", ev => {
    if (ev.target.matches(".score-input")) {
      rememberVisibleScores();
      renderGroupCards();
      renderActiveStandings();
      syncBracketWithGroups();
      renderBracket();
    }
    renderProgressDashboard();
    renderMySummary();
    renderGlobalStats();
    scheduleDraftAutosave();
  });
}

function setAuthMode(mode){
  state.authMode = mode === "edit" ? "edit" : "register";
  $$(".mode-card").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === state.authMode));
  if (state.authMode === "register") {
    $("#authHelp").textContent = "Si es tu primera vez, se creará tu usuario con ese PIN. Acuérdate bien: lo necesitarás para editar.";
    $("#loginBtn").textContent = "Crear usuario y entrar";
    $("#playerPin").setAttribute("autocomplete", "new-password");
  } else {
    $("#authHelp").textContent = "Introduce el mismo nombre y PIN que usaste al crear tu usuario para editar tu predicción.";
    $("#loginBtn").textContent = "Entrar para editar";
    $("#playerPin").setAttribute("autocomplete", "current-password");
  }
}



function isEditOpen(){ return Date.now() <= new Date(APP_CONFIG.EDIT_DEADLINE_ISO).getTime(); }










async function login(){
  const name = $("#playerName").value.trim();
  const pin = $("#playerPin").value;
  const msg = $("#loginMsg");
  msg.textContent = ""; msg.className = "message";
  if (!name || !pin) return setMsg(msg, "Introduce nombre y PIN.", false);
  try {
    const data = await api("login", { name, pin, mode: state.authMode, avatar: state.avatar });
    state.player = data.name;
    state.pin = pin;
    state.prediction = data.prediction || null;
    if (data.avatar) state.avatar = data.avatar;
    setMsg(msg, data.created ? "Usuario creado. Acuérdate de tu PIN." : "Has entrado correctamente.", true);
    if (state.prediction) fillForm(state.prediction);
    else notifyDraftIfExists();
    await refreshState();
    updateStatus();
  } catch(e) { setMsg(msg, e.message, false); }
}








function renderActiveGroup(){
  const group = state.activeGroup;
  $("#activeGroupLabel").textContent = group;
  const matches = WC_DATA.matches.filter(m => m.group === group).sort((a,b)=>a.id-b.id);
  $("#activeGroupMatches").innerHTML = `<div class="match-cards">${matches.map(m => `
    <div class="match-card" data-match-id="${m.id}">
      <div class="date-badge"><strong>${dayOfMonth(m.date)}</strong><span>${monthDay(m.date)}</span></div>
      <div class="team team-home"><span class="flag-inline">${flag(m.home)}</span><strong>${escapeHtml(displayTeam(m.home))}</strong></div>
      <div class="score-box"><input class="score-input" type="number" min="0" inputmode="numeric" name="m${m.id}_home" aria-label="Goles ${escapeAttr(displayTeam(m.home))}" /> <span>-</span> <input class="score-input" type="number" min="0" inputmode="numeric" name="m${m.id}_away" aria-label="Goles ${escapeAttr(displayTeam(m.away))}" /></div>
      <div class="team team-away"><strong>${escapeHtml(displayTeam(m.away))}</strong><span class="flag-inline">${flag(m.away)}</span></div>
      <div class="match-meta">Partido ${m.id} · ${escapeHtml(m.city)} · ${escapeHtml(m.venue)}</div>
    </div>`).join("")}</div>`;
  restoreVisibleScores();
  renderActiveStandings();
}

function renderActiveStandings(){
  const standings = calculateStandings()[state.activeGroup] || [];
  $("#activeGroupStandings").innerHTML = `<div class="standings-box"><h3>Clasificación automática Grupo ${state.activeGroup}</h3>
    <div class="table-wrap"><table class="mini-table"><thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>GF</th><th>GC</th><th>DG</th></tr></thead><tbody>
      ${standings.map((r,i)=>`<tr><td>${i+1}</td><td>${flag(r.team)} <strong>${escapeHtml(displayTeam(r.team))}</strong></td><td>${r.pts}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd}</td></tr>`).join("")}
    </tbody></table></div></div>`;
}

function renderBestXI(){
  const positions = [
    ["POR",1,"Portero"], ["LD",2,"Lateral derecho"], ["DFC",3,"Central derecho"], ["DFC",4,"Central izquierdo"], ["LI",5,"Lateral izquierdo"],
    ["MC",6,"Medio derecho"], ["MC",7,"Medio centro"], ["MC",8,"Medio izquierdo"], ["ED",9,"Extremo derecho"], ["DC",10,"Delantero centro"], ["EI",11,"Extremo izquierdo"]
  ];
  $("#bestXIFormation").innerHTML = `
    <div class="pitch-line forwards">${positions.filter(p=>["ED","DC","EI"].includes(p[0])).map(playerSlot).join("")}</div>
    <div class="pitch-line midfielders">${positions.filter(p=>p[0]==="MC").map(playerSlot).join("")}</div>
    <div class="pitch-line defenders">${positions.filter(p=>["LD","DFC","LI"].includes(p[0])).map(playerSlot).join("")}</div>
    <div class="pitch-line goalkeeper">${positions.filter(p=>p[0]==="POR").map(playerSlot).join("")}</div>`;
}
function playerSlot([pos, num, label]){
  return `<label class="player-slot"><span>${pos}</span><input name="bestXI_${num}" placeholder="${label}" /></label>`;
}






function rememberVisibleScores(){
  WC_DATA.matches.filter(m => m.group === state.activeGroup).forEach(m => {
    const h = document.querySelector(`[name="m${m.id}_home"]`);
    const a = document.querySelector(`[name="m${m.id}_away"]`);
    state.scores[m.id] = {
      home: h && h.value !== "" ? Number(h.value) : null,
      away: a && a.value !== "" ? Number(a.value) : null
    };
  });
}






function cleanupRound(prev, next){
  const allowed = new Set(state.knockout[prev] || []);
  state.knockout[next] = (state.knockout[next] || []).map(t => allowed.has(t) ? t : "");
}







function teamLine(team){ return `<span class="flag-inline">${flag(team)}</span><strong>${escapeHtml(displayTeam(team))}</strong>`; }






function roundSize(round){ return ({ r32:32, r16:16, qf:8, sf:4, final:2 }[round] || 1); }
function nextRound(round){ return ({ r32:"r16", r16:"qf", qf:"sf", sf:"final", final:"champion" }[round]); }
function getRoundSlot(round, matchIndex){
  return (window.KNOCKOUT_SLOTS?.[round] || [])[matchIndex] || null;
}
function findNextSlotPosition(round, matchIndex){
  const next = nextRound(round);
  if (!next || next === "champion") return matchIndex;
  const current = getRoundSlot(round, matchIndex);
  if (!current || !current.id) return matchIndex;
  const nextSlots = window.KNOCKOUT_SLOTS?.[next] || [];
  for (let i = 0; i < nextSlots.length; i++){
    const from = nextSlots[i].from || [];
    const pos = from.indexOf(current.id);
    if (pos !== -1) return i * 2 + pos;
  }
  return matchIndex;
}

function groupCompletion(group){
  return WC_DATA.matches.filter(m => m.group === group && getScoreValue(`m${m.id}_home`) !== null && getScoreValue(`m${m.id}_away`) !== null).length;
}
function groupCompletionAll(){ return WC_DATA.matches.filter(m => getScoreValue(`m${m.id}_home`) !== null && getScoreValue(`m${m.id}_away`) !== null).length; }
function getScoreValue(name){
  const match = /^m(\d+)_(home|away)$/.exec(name);
  if (match) {
    const id = match[1], side = match[2];
    if (state.scores[id] && state.scores[id][side] !== null && state.scores[id][side] !== undefined) return Number(state.scores[id][side]);
  }
  const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
  if (!el || el.value === "") return null;
  return Number(el.value);
}
function restoreVisibleScores(){ fillScoresOnly({ matchScores: state.scores }); }











function closeReviewModal(){
  $("#reviewModal")?.classList.add("hidden");
  state.pendingPrediction = null;
}

function draftKey(){
  const who = state.player ? normTeam(state.player) : "sin_usuario";
  return `exsys-world-cup:draft:${who}`;
}
let draftTimer = null;
function scheduleDraftAutosave(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (state.player) saveDraftLocal(true);
  }, 800);
}




function clearDraftLocal(showMsg=true){
  localStorage.removeItem(draftKey());
  if (showMsg) setMsg($("#saveMsg"), "Borrador local eliminado.", true);
}
function notifyDraftIfExists(){
  const raw = localStorage.getItem(draftKey());
  if (raw) setMsg($("#saveMsg"), "Tienes un borrador local guardado. Pulsa 'Recuperar borrador' si quieres cargarlo.", true);
}

function fillForm(pred){
  if (!pred) return;
  fillScoresOnly(pred);
  state.knockout = { ...(pred.knockout || {}) };
  if (state.knockout.finalists && !state.knockout.final) state.knockout.final = state.knockout.finalists;
  const set = (name, value) => { const el = document.querySelector(`[name="${CSS.escape(name)}"]`); if (el) el.value = value ?? ""; };
  const aw = pred.awards || {};
  (aw.goldenBoot || []).forEach((v,i)=>set(`goldenBoot${i+1}`, v));
  (aw.goldenBall || []).forEach((v,i)=>set(`goldenBall${i+1}`, v));
  (aw.goldenGlove || []).forEach((v,i)=>set(`goldenGlove${i+1}`, v));
  (aw.bestYoung || []).forEach((v,i)=>set(`bestYoung${i+1}`, v));
  (aw.bestXI || []).forEach((v,i)=>set(`bestXI_${i+1}`, v));
  renderGroupCards(); renderActiveGroup(); syncBracketWithGroups(); renderBracket();
}
function fillScoresOnly(pred){
  Object.entries(pred.matchScores || {}).forEach(([id,sc]) => {
    state.scores[id] = { home: sc.home ?? null, away: sc.away ?? null };
    const h = document.querySelector(`[name="m${CSS.escape(id)}_home"]`);
    const a = document.querySelector(`[name="m${CSS.escape(id)}_away"]`);
    if (h) h.value = sc.home ?? "";
    if (a) a.value = sc.away ?? "";
  });
}



function rankingPodiumCard(r,i,prev){
  const mv = rankingMovement(r, i, prev);
  return `<div class="podium-card podium-${i+1}"><div class="podium-medal">${medal(i)}</div><strong>${escapeHtml(r.name)}</strong><span>${r.total || 0} pts</span><small class="movement ${mv.cls}">${mv.label}</small></div>`;
}


function readPreviousRankingSnapshot(){
  try { return JSON.parse(localStorage.getItem("exsys-world-cup:rankingSnapshot") || "{}"); } catch(e){ return {}; }
}
function saveRankingSnapshot(rows){
  const snap = {};
  rows.forEach((r,i)=> snap[normTeam(r.name)] = { pos:i+1, total:Number(r.total||0) });
  localStorage.setItem("exsys-world-cup:rankingSnapshot", JSON.stringify(snap));
}
function rankingMovement(r,i,prev){
  const key = normTeam(r.name);
  if (!prev[key]) return { label:"Nuevo", cls:"new" };
  const posDiff = prev[key].pos - (i+1);
  const ptsDiff = Number(r.total||0) - Number(prev[key].total||0);
  if (posDiff > 0) return { label:`▲ ${posDiff} puesto${posDiff>1?"s":""} · +${ptsDiff} pts`, cls:"up" };
  if (posDiff < 0) return { label:`▼ ${Math.abs(posDiff)} puesto${Math.abs(posDiff)>1?"s":""} · +${ptsDiff} pts`, cls:"down" };
  return { label:`— · +${ptsDiff} pts`, cls:"same" };
}



function teamNameWithFlag(team){
  if (!team || team === "—") return "—";
  return `${flag(team)} ${escapeHtml(displayTeam(team))}`;
}

function renderComparisonPanel(){
  const el = $("#comparePanel");
  if (!el) return;
  if (isEditOpen()) {
    el.innerHTML = `<div class="empty-state">Predicciones bloqueadas hasta el cierre. ExSys no permite copiar entregables, ni aunque vengas con cara de “solo era una duda rápida”.</div>`;
    return;
  }
  const preds = (state.server.predictions || []).filter(p=>p.prediction);
  if (preds.length < 2) { el.innerHTML = ""; return; }
  const options = preds.map(p=>`<option value="${escapeAttr(p.name)}">${escapeHtml(p.name)}</option>`).join("");
  const a = el.querySelector("#compareA")?.value || preds[0].name;
  const b = el.querySelector("#compareB")?.value || (preds[1]?.name || preds[0].name);
  const pa = preds.find(p=>p.name===a) || preds[0];
  const pb = preds.find(p=>p.name===b) || preds[1] || preds[0];
  el.innerHTML = `<div class="compare-card"><h3>⚔️ Comparar amigos</h3><div class="compare-controls"><select id="compareA">${options}</select><select id="compareB">${options}</select></div>${comparePredictions(pa,pb)}</div>`;
  $("#compareA", el).value = pa.name;
  $("#compareB", el).value = pb.name;
  $("#compareA", el).addEventListener("change", renderComparisonPanel);
  $("#compareB", el).addEventListener("change", renderComparisonPanel);
}
function comparePredictions(pa,pb){
  const a=pa.prediction||{}, b=pb.prediction||{};
  const ak=a.knockout||{}, bk=b.knockout||{}, aa=a.awards||{}, ba=b.awards||{};
  const champA=(ak.champion||[])[0]||"—", champB=(bk.champion||[])[0]||"—";
  const bootA=(aa.goldenBoot||[])[0]||"—", bootB=(ba.goldenBoot||[])[0]||"—";
  const groupsDiff = GROUP_ORDER.filter(g => JSON.stringify((a.groupPositions||{})[g]||[]) !== JSON.stringify((b.groupPositions||{})[g]||[])).length;
  const koDiff = ["r16","qf","sf","finalists","champion"].filter(k => JSON.stringify((ak[k]||[]).filter(Boolean)) !== JSON.stringify((bk[k]||[]).filter(Boolean))).length;
  return `<div class="compare-results"><p><b>Campeón:</b> ${teamNameWithFlag(champA)} <em>vs</em> ${teamNameWithFlag(champB)}</p><p><b>Bota de Oro:</b> ${escapeHtml(bootA)} <em>vs</em> ${escapeHtml(bootB)}</p><p><b>Grupos distintos:</b> ${groupsDiff}/12</p><p><b>Rondas distintas:</b> ${koDiff}/5</p></div>`;
}





function statBox(title, counts, asTeam){
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3);
  return `<div class="stat-box"><span>${title}</span>${entries.length ? entries.map(([k,v],i)=>`<p><b>${i+1}.</b> ${asTeam?teamNameWithFlag(k):escapeHtml(k)} <strong>${v}</strong></p>`).join("") : "<p class='muted'>Sin datos</p>"}</div>`;
}



function renderPredictionGroupReview(pred){
  const realTables = calculateRealStandingsFromServer();
  const realResults = state.server.results || {};
  const hasReal = Object.keys(realResults).length > 0;
  return `<div class="pred-groups-review">${GROUP_ORDER.map(g => {
    const top3 = (pred.groupPositions?.[g] || []).slice(0,3);
    const realTop3 = (realTables[g] || []).slice(0,3).map(x=>x.team);
    const matches = WC_DATA.matches.filter(m=>m.group===g);
    return `<div class="pred-group-card"><h4>Grupo ${g}</h4>
      <ol class="pred-top3">${top3.map((team,i)=>`<li class="${hasReal && normTeam(team)===normTeam(realTop3[i])?'hit-exact':''}">${flag(team)} ${escapeHtml(displayTeam(team) || '—')}</li>`).join("")}</ol>
      <div class="pred-match-list">${matches.map(m => renderPredMatchLine(m, pred.matchScores?.[m.id], realResults[m.id])).join("")}</div>
    </div>`;
  }).join("")}</div>`;
}


function calculateRealStandingsFromServer(){
  const savedScores = state.scores;
  state.scores = state.server.results || {};
  const tables = calculateStandings();
  state.scores = savedScores;
  return tables;
}
function matchSign(a,b){ a=Number(a); b=Number(b); return a>b?'H':a<b?'A':'D'; }
function normTeam(t){ return String(t||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '); }



function clean(v){ return String(v || "").trim(); }
function displayTeam(t){ return TEAM_DISPLAY[t] || t; }
function flag(t){
  const code = TEAM_FLAG_CODES[t];
  if (!code) return `<span class="flag-img flag-fallback">🏳️</span>`;
  const name = escapeAttr(displayTeam(t));
  return `<img class="flag-img" src="https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${code}.svg" alt="${name}" title="${name}" loading="lazy">`;
}
function dayOfMonth(iso){ return new Date(iso+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric"}); }
function monthDay(iso){ return new Date(iso+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"}).replace(".","").toUpperCase(); }
function formatDateTime(iso){ return iso ? new Date(iso).toLocaleString("es-ES") : "—"; }
function escapeHtml(str){ return String(str ?? "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }
function escapeAttr(str){ return escapeHtml(str).replace(/"/g,"&quot;"); }

/* =========================
   v8 UX + visual upgrade
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", ev => {
    if (ev.target.closest("#nextIncompleteGroupBtn")) goToNextIncompleteGroup();
  });
  document.addEventListener("change", ev => {
    if (ev.target.matches("#compareA,#compareB")) renderCompareResult();
  });
  setInterval(updateDeadlineCountdown, 60000);
  updateDeadlineCountdown();
});




function updateStatus(){
  const cp = $("#currentPlayer"); if (cp) cp.textContent = state.player || "No identificado";
  const es = $("#editStatus"); if (es) es.textContent = isEditOpen() ? "Abierta hasta 10/06/2026" : "Cerrada";
  const ss = $("#submittedStatus"); if (ss) ss.textContent = state.prediction ? "Enviada" : "Pendiente";
  const sb = $("#savePredictionBtn"); if (sb) sb.disabled = !isEditOpen();
  const lb = $("#lockedBanner"); if (lb) lb.classList.toggle("hidden", isEditOpen());
  updateDeadlineCountdown();
  renderProgressDashboard();
}

async function refreshState(){
  if (!state.player || !state.pin) return;
  try {
    const data = await api("getState", { name: state.player, pin: state.pin });
    state.prediction = data.myPrediction || state.prediction;
    state.server = { predictions: data.predictions || [], ranking: data.ranking || [], results: data.results || {}, awards: data.awards || {}, participants: data.participants || [], pot: data.pot || {} };
    renderRanking(); renderFriendsPredictions(); renderMySummary(); renderGlobalStats(); renderCompare(); renderParticipants(); renderCommandCenter(); renderLiveImpact(); updateStatus();
  } catch(e) { console.warn(e); }
}

function updateDeadlineCountdown(){
  const el = $("#deadlineCountdown");
  if (!el) return;
  const end = new Date(APP_CONFIG.EDIT_DEADLINE_ISO).getTime();
  const diff = end - Date.now();
  if (diff <= 0) { el.textContent = "CERRADO"; return; }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  el.textContent = `${days} días · ${hours} h`;
}

function completionStats(){
  const totalMatches = WC_DATA.matches.length;
  const doneMatches = groupCompletionAll();
  const ko = state.knockout || {};
  const koDone = [ko.r16, ko.qf, ko.sf, ko.final, ko.champion].reduce((n, arr) => n + ((arr || []).filter(Boolean).length), 0);
  const koTotal = 16 + 8 + 4 + 2 + 1;
  const aw = collectPredictionSafe().awards || {};
  const awardsDone = [aw.goldenBall,aw.goldenBoot,aw.goldenGlove,aw.bestYoung].reduce((n,a)=>n+(a||[]).filter(Boolean).length,0);
  const xiDone = (aw.bestXI || []).filter(Boolean).length;
  return { totalMatches, doneMatches, koDone, koTotal, awardsDone, awardsTotal:12, xiDone, xiTotal:11 };
}
function collectPredictionSafe(){
  try { return collectPrediction(); } catch(e) { return { matchScores:{}, groupPositions:{}, knockout:state.knockout||{}, awards:{} }; }
}



function renderGroupCards(){
  const container = $("#groupCardsContainer");
  if (!container) return;
  container.innerHTML = GROUP_ORDER.map(group => {
    const teams = WC_DATA.groups[group];
    const done = groupCompletion(group);
    const status = done === 6 ? "complete" : done > 0 ? "partial" : "empty";
    const statusLabel = done === 6 ? "🟢 Completo" : done > 0 ? "🟡 Incompleto" : "🔴 Sin empezar";
    const top = (calculateStandings()[group] || []).slice(0,3).map(x=>x.team);
    return `<button type="button" class="group-tile ${state.activeGroup===group?'active':''} ${status}" data-group="${group}">
      <span class="group-name">Grupo ${group} <small>${statusLabel}</small></span>
      <span class="flag-box team-grid-names">${teams.map(t=>`<span class="flag-chip team-mini" title="${escapeAttr(displayTeam(t))}">${flag(t)}<em>${escapeHtml(displayTeam(t))}</em></span>`).join("")}</span>
      <span class="group-action">${done}/6 partidos · ${done===6?'Ver grupo':'Meter resultados'}</span>
      ${top.length ? `<span class="group-top3">Top 3: ${top.map(t=>displayTeam(t)).join(" · ")}</span>` : ""}
    </button>`;
  }).join("");
  $$(".group-tile", container).forEach(btn => btn.addEventListener("click", () => {
    state.activeGroup = btn.dataset.group;
    renderGroupCards(); renderActiveGroup(); renderMySummary(); renderProgressDashboard();
    $("#groupEditorCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  renderProgressDashboard();
}

function goToNextIncompleteGroup(){
  const next = GROUP_ORDER.find(g => groupCompletion(g) < 6) || GROUP_ORDER[0];
  state.activeGroup = next;
  renderGroupCards(); renderActiveGroup();
  $("#groupEditorCard")?.scrollIntoView({ behavior:"smooth", block:"start" });
}









function rankingCard(r,i,previous){ return `<div class="podium-card p${i+1}"><div class="podium-medal">${medal(i)}</div><strong>${escapeHtml(r.name)}</strong><span>${r.total||0} pts</span><small>${movementBadge(r.name,i,previous)}</small></div>`; }
function medal(i){ return i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅'; }
function movementBadge(name,i,previous){
  const old = previous?.[name];
  if (!old) return `<span class="move new">nuevo</span>`;
  const diff = old - (i+1);
  if (diff > 0) return `<span class="move up">▲ +${diff}</span>`;
  if (diff < 0) return `<span class="move down">▼ ${diff}</span>`;
  return `<span class="move same">—</span>`;
}

function renderFriendsPredictions(){
  const container = $("#friendsPredictionsContainer");
  if (!container) return;
  if (isEditOpen()) {
    container.innerHTML = `<p class="muted">Predicciones ocultas hasta el cierre. ExSys no deja copiar, que luego vienen los “yo ya lo tenía en mente”.</p>`;
    return;
  }
  const preds = state.server.predictions || [];
  if (!preds.length) return container.innerHTML = `<p class="muted">Todavía no hay predicciones guardadas.</p>`;
  container.innerHTML = preds.map(p => {
    const pred = p.prediction || {}, aw = pred.awards || {}, ko = pred.knockout || {};
    return `<details class="pred-card"><summary><strong>${escapeHtml(p.name)}</strong> · ${formatDateTime(p.updatedAt || pred.updatedAt)}</summary>
      <div class="pred-highlight-note"><span class="pill-correct">verde fuerte = exacto</span> <span class="pill-partial">verde suave = signo/acierto parcial</span> <span class="pill-wrong">rojo suave = fallo</span></div>
      ${renderPredictionGroupReview(pred)}
      <div class="prediction-awards">
        <p><strong>Campeón:</strong> ${escapeHtml((ko.champion || ["—"])[0] || "—")}</p>
        <p><strong>Finalistas:</strong> ${escapeHtml((ko.finalists || []).join(", ") || "—")}</p>
        <p><strong>Bota de Oro:</strong> ${escapeHtml((aw.goldenBoot || []).join(", ") || "—")}</p>
        <p><strong>Balón de Oro:</strong> ${escapeHtml((aw.goldenBall || []).join(", ") || "—")}</p>
        <p><strong>Guante de Oro:</strong> ${escapeHtml((aw.goldenGlove || []).join(", ") || "—")}</p>
        <p><strong>Mejor joven:</strong> ${escapeHtml((aw.bestYoung || []).join(", ") || "—")}</p>
        <p><strong>11 ideal:</strong> ${escapeHtml((aw.bestXI || []).join(", ") || "—")}</p>
      </div>
    </details>`;
  }).join("");
}
function renderPredMatchLine(m, pred, real){
  const hasPred = pred && pred.home !== null && pred.away !== null && pred.home !== undefined && pred.away !== undefined;
  let cls = "";
  if (hasPred && real) {
    if (Number(pred.home) === Number(real.home) && Number(pred.away) === Number(real.away)) cls = "hit-exact";
    else if (matchSign(pred.home, pred.away) === matchSign(real.home, real.away)) cls = "hit-partial";
    else cls = "hit-wrong";
  }
  return `<div class="pred-match-line ${cls}"><span>${flag(m.home)} ${escapeHtml(displayTeam(m.home))}</span><strong>${hasPred ? `${pred.home}-${pred.away}` : '—'}</strong><span>${escapeHtml(displayTeam(m.away))} ${flag(m.away)}</span></div>`;
}






function renderGlobalStats(){
  const el = $("#globalStatsContainer"); if (!el) return;
  if (isEditOpen()) { el.innerHTML = `<p class="muted">Estadísticas ocultas hasta el cierre. ExSys guarda el salseo en una carpeta con permisos restringidos.</p>`; return; }
  const preds = state.server.predictions || [];
  if (!preds.length) { el.innerHTML = `<p class="muted">Aún no hay predicciones suficientes. La estadística también necesita carnaza.</p>`; return; }
  const champions = countValues(preds.map(p=>p.prediction?.knockout?.champion?.[0]));
  const boots = countValues(preds.map(p=>p.prediction?.awards?.goldenBoot?.[0]));
  const balls = countValues(preds.map(p=>p.prediction?.awards?.goldenBall?.[0]));
  const risky = findUniqueChampion(preds, champions);
  el.innerHTML = `<div class="stats-grid">
    ${statCard('🏆 Campeón más elegido', topValue(champions))}
    ${statCard('🥾 Bota de Oro más elegida', topValue(boots))}
    ${statCard('⭐ Balón de Oro más elegido', topValue(balls))}
    ${statCard('🎲 Predicción más rara', risky)}
  </div>`;
}
function countValues(values){ return values.filter(Boolean).reduce((acc,v)=>{ acc[v]=(acc[v]||0)+1; return acc; },{}); }
function topValue(obj){ const e=Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]; return e ? `${displayTeam(e[0])} · ${e[1]} votos` : '—'; }
function findUniqueChampion(preds, counts){ const p = preds.find(x => counts[x.prediction?.knockout?.champion?.[0]] === 1); return p ? `${p.name}: ${displayTeam(p.prediction.knockout.champion[0])}` : 'Sin rarezas todavía'; }
function statCard(title, value){ return `<div class="stat-card"><span>${title}</span><strong>${escapeHtml(value)}</strong></div>`; }

window.addEventListener("resize", () => requestAnimationFrame(drawBracketLines));

/* =========================
   v13: pulido pre-publicación
   ========================= */

function toast(message, type="ok"){
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  const icon = type === "err" ? "❌" : type === "warn" ? "⚠️" : "✅";
  item.innerHTML = `<span>${icon}</span><strong>${escapeHtml(message)}</strong>`;
  stack.appendChild(item);
  requestAnimationFrame(()=>item.classList.add("show"));
  setTimeout(()=>{ item.classList.remove("show"); setTimeout(()=>item.remove(), 260); }, 4200);
}

function setMsg(el, txt, ok){
  if (el) {
    el.textContent = txt;
    el.className = "message " + (ok ? "ok" : "err");
  }
  if (txt) toast(txt, ok ? "ok" : "err");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("rulesModalBtn")?.addEventListener("click", openRulesModal);
  document.getElementById("closeRulesModalBtn")?.addEventListener("click", closeRulesModal);
  document.getElementById("rulesModal")?.addEventListener("click", ev => {
    if (ev.target.id === "rulesModal") closeRulesModal();
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape") { closeRulesModal(); closeReviewModal(); }
  });
  renderCompletionChecklist();
  updateAutosaveStatus();
});

function openRulesModal(){ document.getElementById("rulesModal")?.classList.remove("hidden"); }
function closeRulesModal(){ document.getElementById("rulesModal")?.classList.add("hidden"); }




function renderProgressDashboard(){
  const el = document.getElementById("progressDashboard");
  if (!el) return;
  const s = sectionProgress();
  const total = s.totalMatches + s.koTotal + s.awardsTotal + s.xiTotal;
  const done = s.matchesDone + s.koDone + s.awardsDone + s.xiDone;
  const pct = total ? Math.round(done * 100 / total) : 0;
  el.innerHTML = `
    <div class="progress-top"><strong>Progreso de tu porra</strong><span>${pct}%</span></div>
    <div class="progress-bar"><span style="width:${pct}%"></span></div>
    <div class="progress-chips">
      <span class="${s.matchesDone===s.totalMatches?'ok':''}">🌍 Grupos ${s.matchesDone}/${s.totalMatches}</span>
      <span class="${s.koDone===s.koTotal?'ok':''}">🥊 Eliminatorias ${s.koDone}/${s.koTotal}</span>
      <span class="${s.awardsDone===s.awardsTotal?'ok':''}">⭐ Premios ${s.awardsDone}/${s.awardsTotal}</span>
      <span class="${s.xiDone===s.xiTotal?'ok':''}">⚽ 11 ideal ${s.xiDone}/${s.xiTotal}</span>
    </div>`;
  renderCompletionChecklist();
}

function renderCompletionChecklist(){
  const el = document.getElementById("completionChecklist");
  if (!el) return;
  const s = sectionProgress();
  const items = [
    ["Fase de grupos", s.matchesDone, s.totalMatches, "🌍"],
    ["Eliminatorias", s.koDone, s.koTotal, "🥊"],
    ["Premios", s.awardsDone, s.awardsTotal, "⭐"],
    ["11 ideal", s.xiDone, s.xiTotal, "⚽"]
  ];
  el.innerHTML = `<h3>Checklist antes de guardar</h3><div class="checklist-grid">${items.map(([label,done,total,icon])=>{
    const ok = done === total;
    const started = done > 0 && !ok;
    return `<div class="check-item ${ok?'ok':started?'warn':'empty'}"><span>${ok?'✅':started?'⚠️':'⭕'}</span><strong>${icon} ${label}</strong><em>${done}/${total}</em></div>`;
  }).join("")}</div>`;
}

function updateAutosaveStatus(savedAt=null){
  const el = document.getElementById("autosaveStatus");
  if (!el) return;
  if (!savedAt) {
    try { savedAt = JSON.parse(localStorage.getItem(draftKey()) || "{}").savedAt; } catch(e){}
  }
  el.textContent = savedAt ? `💾 Borrador local guardado automáticamente a las ${new Date(savedAt).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}` : "💾 Borrador local: todavía sin guardar";
}

function saveDraftLocal(silent=false){
  const msg = document.getElementById("saveMsg");
  try {
    const prediction = collectPrediction();
    const savedAt = new Date().toISOString();
    localStorage.setItem(draftKey(), JSON.stringify({ player: state.player || "", prediction, savedAt }));
    updateAutosaveStatus(savedAt);
    if (!silent && msg) setMsg(msg, "Borrador local guardado. Por si el navegador decide hacer la cobra.", true);
  } catch(e) {
    if (!silent && msg) setMsg(msg, "No se pudo guardar el borrador local.", false);
  }
}

function loadDraftLocal(){
  const msg = document.getElementById("saveMsg");
  const raw = localStorage.getItem(draftKey());
  if (!raw) return setMsg(msg, "No hay borrador local para este jugador en este navegador.", false);
  try {
    const data = JSON.parse(raw);
    fillForm(data.prediction);
    updateAutosaveStatus(data.savedAt);
    renderCompletionChecklist();
    setMsg(msg, `Borrador recuperado (${formatDateTime(data.savedAt)}).`, true);
  } catch(e) { setMsg(msg, "El borrador local está dañado. Drama innecesario, pero drama.", false); }
}

async function savePrediction(ev){
  ev.preventDefault();
  const msg = document.getElementById("saveMsg");
  if (msg) { msg.textContent = ""; msg.className = "message"; }
  if (!state.player || !state.pin) return setMsg(msg, "Primero entra con tu nombre y PIN, que esto no va por telepatía.", false);
  if (!isEditOpen()) return setMsg(msg, "La edición está cerrada. Llegas tarde, como en las pachangas.", false);
  let prediction = collectPrediction();
  prediction = attachPredictionMetadata(prediction);
  const validation = validatePrediction(prediction);
  if (!validation.ok) {
    renderCompletionChecklist();
    return setMsg(msg, "Faltan datos: " + validation.missing.slice(0,8).join(" · ") + (validation.missing.length > 8 ? "..." : "") + ". Respira, revisa y no culpes al sistema.", false);
  }
  state.pendingPrediction = prediction;
  showReviewModal(prediction);
}




async function confirmSavePrediction(){
  const msg = document.getElementById("saveMsg");
  if (!state.pendingPrediction) return;
  try {
    await api("savePrediction", { name: state.player, pin: state.pin, prediction: state.pendingPrediction });
    state.prediction = state.pendingPrediction;
    renderReceipt(state.prediction);
    clearDraftLocal(false);
    updateAutosaveStatus(null);
    closeReviewModal();
    setMsg(msg, "ExSys ha registrado tu entregable ⚽📊. Luego no vengas con que “se envió solo”.", true);
    toast("ExSys ha registrado tu entregable ⚽📊", "ok");
    await refreshState();
  } catch(e) { setMsg(msg, e.message, false); }
}

function renderRanking(){
  const rows = state.server.ranking || [];
  const container = document.getElementById("rankingContainer");
  if (!container) return;
  if (!rows.length) return container.innerHTML = `<div class="empty-state">🏟️ Todavía no hay ranking calculado. De momento todos podéis seguir fingiendo que vais líderes.</div>`;
  const previous = readPreviousRankingSnapshot();
  container.innerHTML = `
    <div class="ranking-hero">
      <div><span>Líder provisional</span><strong>${escapeHtml(rows[0]?.name || "—")}</strong><em>${rows[0]?.total || 0} pts</em></div>
      <div><span>Participantes</span><strong>${rows.length}</strong><em>compañeros en juego</em></div>
      <div><span>Última actualización</span><strong>${new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</strong><em>según este navegador</em></div>
    </div>
    <div class="ranking-podium premium-podium">${rows.slice(0,3).map((r,i)=>rankingPodiumCard(r,i,previous)).join("")}</div>
    <div class="table-wrap ranking-table premium-ranking"><table><thead><tr><th>#</th><th>Jugador</th><th>Total</th><th>Movimiento</th><th>Grupos</th><th>Eliminatorias</th><th>Premios</th></tr></thead><tbody>${rows.map((r,i)=>{
      const mv = rankingMovement(r, i, previous);
      return `<tr><td>${medal(i)} ${i+1}</td><td><strong>${escapeHtml(r.name)}</strong></td><td><strong>${r.total || 0}</strong></td><td><span class="movement ${mv.cls}">${mv.label}</span></td><td>${r.groupPoints || 0}</td><td>${r.koPoints || 0}</td><td>${r.awardPoints || 0}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  saveRankingSnapshot(rows);
}

function renderCompare(){
  const el = document.getElementById("compareContainer");
  if (!el) return;
  if (isEditOpen()) { el.innerHTML = `<div class="empty-state">Comparativa bloqueada hasta el cierre. Primero se apuesta, luego se cotillea. Orden, compañeros.</div>`; return; }
  const preds = state.server.predictions || [];
  if (preds.length < 2) { el.innerHTML = `<div class="empty-state">Hacen falta al menos dos porras guardadas. Ahora mismo compararte contigo mismo sería triste.</div>`; return; }
  const opts = preds.map(p=>`<option value="${escapeAttr(p.name)}">${escapeHtml(p.name)}</option>`).join("");
  const currentA = document.getElementById("compareA")?.value || state.player || preds[0].name;
  const currentB = document.getElementById("compareB")?.value || preds.find(p=>p.name!==currentA)?.name || preds[1]?.name || preds[0].name;
  el.innerHTML = `<div class="compare-card premium-compare"><div class="compare-controls"><label>Jugador A<select id="compareA">${opts}</select></label><label>Jugador B<select id="compareB">${opts}</select></label></div><div id="compareResult"></div></div>`;
  document.getElementById("compareA").value = preds.some(p=>p.name===currentA) ? currentA : preds[0].name;
  document.getElementById("compareB").value = preds.some(p=>p.name===currentB) ? currentB : (preds[1]?.name || preds[0].name);
  document.getElementById("compareA").addEventListener("change", renderCompareResult);
  document.getElementById("compareB").addEventListener("change", renderCompareResult);
  renderCompareResult();
}

function renderCompareResult(){
  const el = document.getElementById("compareResult"); if (!el) return;
  const aName = document.getElementById("compareA")?.value, bName = document.getElementById("compareB")?.value;
  const preds = state.server.predictions || [];
  const Arow = preds.find(p=>p.name===aName), Brow = preds.find(p=>p.name===bName);
  const A = Arow?.prediction, B = Brow?.prediction;
  if (!A || !B) return;
  const champA = A.knockout?.champion?.[0] || "—";
  const champB = B.knockout?.champion?.[0] || "—";
  const bootA = A.awards?.goldenBoot?.[0] || "—";
  const bootB = B.awards?.goldenBoot?.[0] || "—";
  const finalA = (A.knockout?.finalists || A.knockout?.final || []).filter(Boolean).map(displayTeam).join(" vs ") || "—";
  const finalB = (B.knockout?.finalists || B.knockout?.final || []).filter(Boolean).map(displayTeam).join(" vs ") || "—";
  const groupsDiff = GROUP_ORDER.filter(g => JSON.stringify((A.groupPositions?.[g]||[]).slice(0,3)) !== JSON.stringify((B.groupPositions?.[g]||[]).slice(0,3))).length;
  const koDiff = ["r16","qf","sf","finalists","champion"].filter(k => JSON.stringify(A.knockout?.[k]||[]) !== JSON.stringify(B.knockout?.[k]||[])).length;
  const sameChampion = normTeam(champA) === normTeam(champB);
  const verdict = sameChampion ? "Van de la mano con el campeón. Sospechoso, pero aceptable." : "Aquí hay pelea: uno de los dos va a poder vacilar fuerte.";
  el.innerHTML = `<div class="compare-result premium-result">
    <div class="compare-headline"><strong>${escapeHtml(aName)}</strong><span>VS</span><strong>${escapeHtml(bName)}</strong><em>${escapeHtml(verdict)}</em></div>
    <div><span>Campeón</span><strong>${teamNameWithFlag(champA)} <b>vs</b> ${teamNameWithFlag(champB)}</strong></div>
    <div><span>Final prevista</span><strong>${escapeHtml(finalA)} <b>vs</b> ${escapeHtml(finalB)}</strong></div>
    <div><span>Bota de Oro</span><strong>${escapeHtml(bootA)} <b>vs</b> ${escapeHtml(bootB)}</strong></div>
    <div><span>Grupos distintos</span><strong>${groupsDiff}/12</strong></div>
    <div><span>Rondas distintas</span><strong>${koDiff}/5</strong></div>
  </div>`;
}

function renderForm(){
  renderGroupCards();
  renderActiveGroup();
  renderBestXI();
  syncBracketWithGroups();
  renderBracket();
  renderProgressDashboard();
  renderMySummary();
  renderGlobalStats();
  renderCompare();
  renderParticipants();
  renderCommandCenter();
  renderLiveImpact();
  renderReceipt(state.prediction);
  updateAutosaveStatus();
}


/* =========================
   v17: WhatsApp, resguardo, participantes y centro de mando
   ========================= */
function simpleHash(str){
  let h=2166136261; const s=String(str||"");
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
  return (h>>>0).toString(16).padStart(8,"0");
}
function registrationCode(name, iso){
  const d=new Date(iso); const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0"), hh=String(d.getHours()).padStart(2,"0"), mi=String(d.getMinutes()).padStart(2,"0");
  const slug=String(name||"RATA").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,10) || "RATA";
  return `CR-${slug}-${yyyy}${mm}${dd}-${hh}${mi}`;
}
function attachPredictionMetadata(pred){
  const now=new Date().toISOString();
  const previous=state.prediction?.meta || {};
  const meta={
    avatar: state.avatar || previous.avatar || "🐀",
    createdAt: previous.createdAt || now,
    updatedAt: now,
    predictionVersion: Number(previous.predictionVersion || 0) + 1,
    registrationCode: previous.registrationCode || registrationCode(state.player, now)
  };
  const clone=JSON.parse(JSON.stringify(pred));
  clone.meta=meta;
  const forHash=JSON.parse(JSON.stringify(clone)); delete forHash.meta.predictionHash;
  clone.meta.predictionHash=simpleHash(JSON.stringify(forHash));
  clone.updatedAt=now;
  return clone;
}
function renderReceipt(pred){
  const el=document.getElementById("predictionReceipt"); if(!el) return;
  if(!pred || !pred.meta){ el.classList.add("hidden"); el.innerHTML=""; return; }
  const m=pred.meta;
  el.classList.remove("hidden");
  el.innerHTML=`<h3>🧾 Justificante de predicción guardada</h3><div class="receipt-grid">
    <div><span>Estado</span><strong>Predicción guardada correctamente</strong></div>
    <div><span>Fecha</span><strong>${formatDateTime(m.updatedAt)}</strong></div>
    <div><span>Código</span><strong>${escapeHtml(m.registrationCode)}</strong></div>
    <div><span>Versión</span><strong>v${escapeHtml(m.predictionVersion)}</strong></div>
    <div><span>Hash</span><strong>${escapeHtml(m.predictionHash)}</strong></div>
  </div><p class="muted">Resguardo anti “yo no puse eso”. ExSys archiva, audita y juzga en silencio.</p>`;
}
function buildWhatsAppSummary(pred){
  pred=pred || state.prediction || collectPredictionSafe();
  const ko=pred.knockout||{}, aw=pred.awards||{};
  const champion=(ko.champion||[])[0]||"—";
  const finalists=(ko.finalists||[]).filter(Boolean);
  const runner=finalists.find(t=>t!==champion) || finalists[1] || "—";
  const third=(ko.third||[])[0]||"—";
  const xi=aw.bestXI||[];
  const pos=["POR","LD","DFC","DFC","LI","MC","MC","MC","ED","DC","EI"];
  return [
    "🐀 EXSYS WORLD CUP 2026",
    "",
    `Jugador: ${state.avatar || pred.meta?.avatar || "🐀"} ${state.player || "—"}`,
    "",
    `🏆 Campeón: ${displayTeam(champion)}`,
    `🥈 Subcampeón: ${displayTeam(runner)}`,
    `🥉 Tercer puesto: ${displayTeam(third)}`,
    "",
    `⚽ Pichichi: ${(aw.goldenBoot||[])[0] || "—"}`,
    `🧤 Zamora: ${(aw.goldenGlove||[])[0] || "—"}`,
    `⭐ MVP: ${(aw.goldenBall||[])[0] || "—"}`,
    `🌟 Mejor joven: ${(aw.bestYoung||[])[0] || "—"}`,
    "",
    "Once ideal:",
    ...Array.from({length:11},(_,i)=>`${pos[i]}: ${xi[i] || "—"}`),
    "",
    pred.meta?.registrationCode ? `Código: ${pred.meta.registrationCode}` : "",
    "",
    "ExSys ya lo ha registrado."
  ].filter(line=>line!=="").join("\n");
}
async function copyPredictionForWhatsApp(){
  const msg=document.getElementById("saveMsg");
  if(!state.prediction){ return setMsg(msg,"Primero guarda la porra. ExSys no valida documentos sin adjunto.",false); }
  const text=buildWhatsAppSummary(state.prediction);
  try{ await navigator.clipboard.writeText(text); setMsg(msg,"Predicción copiada para WhatsApp. Ahora a provocar al grupo con elegancia.",true); }
  catch(e){ prompt("Copia tu predicción:", text); }
}
function participantAvatar(name){
  const p=(state.server.participants||[]).find(x=>normTeam(x.name)===normTeam(name));
  const pred=(state.server.predictions||[]).find(x=>normTeam(x.name)===normTeam(name))?.prediction;
  return p?.avatar || pred?.meta?.avatar || "🐀";
}
function renderParticipants(){
  const el=document.getElementById("participantsContainer"); if(!el) return;
  const preds=state.server.predictions||[];
  const known=state.server.participants?.length ? state.server.participants : preds.map(p=>({name:p.name, paid:false, avatar:p.prediction?.meta?.avatar||"🐀"}));
  const predNames=new Set(preds.map(p=>normTeam(p.name)));
  if(!known.length){ el.innerHTML=`<div class="empty-state">Aún no hay participantes. Nadie ha sacado la patita, sospechoso.</div>`; return; }
  el.innerHTML=`<div class="participants-grid">${known.map(p=>{
    const sent=predNames.has(normTeam(p.name));
    const paid=String(p.paid).toLowerCase()==="true" || p.paid===true;
    return `<div class="participant-card ${sent?'sent':'pending'} ${paid?'paid':'unpaid'}"><strong>${escapeHtml(p.avatar||participantAvatar(p.name))} ${escapeHtml(p.name)}</strong><span>${sent?'✅ predicción enviada':'🟡 falta predicción'}</span><span>${paid?'✅ pagado':'🔴 falta pago'}</span></div>`;
  }).join("")}</div>`;
}
function renderCommandCenter(){
  const el=document.getElementById("commandCenterContainer"); if(!el) return;
  if(isEditOpen()){ el.innerHTML=`<div class="empty-state">Centro de mando cerrado hasta el fin del plazo. ExSys no filtra dashboards antes del cierre, que luego hay “alineamientos”.</div>`; return; }
  const preds=state.server.predictions||[];
  if(!preds.length){ el.innerHTML=`<div class="empty-state">Centro de mando sin datos. ExSys tiene el dashboard limpio y la paciencia en mínimos.</div>`; return; }
  const champions=countValues(preds.map(p=>p.prediction?.knockout?.champion?.[0]));
  const boots=countValues(preds.map(p=>p.prediction?.awards?.goldenBoot?.[0]));
  const champTop=topValue(champions);
  const surprise=findUniqueChampion(preds, champions);
  const mainstream=preds.map(p=>({name:p.name,score:mainstreamScore(p.prediction,champions,boots)})).sort((a,b)=>b.score-a.score)[0];
  const chaos=preds.map(p=>({name:p.name,score:chaosScore(p.prediction,champions)})).sort((a,b)=>b.score-a.score)[0];
  const morosos=(state.server.participants||[]).filter(p=>!(String(p.paid).toLowerCase()==="true" || p.paid===true)).map(p=>p.name);
  const pot=state.server.pot || {};
  const entry=Number(pot.entryFee || 0), total=entry*(state.server.participants||[]).length;
  el.innerHTML=`<div class="command-grid">
    ${statCard("🏆 Campeón más elegido", champTop)}
    ${statCard("🧨 Sorpresa más suicida", surprise)}
    ${statCard("🐑 Perfil mainstream", mainstream ? mainstream.name : "—")}
    ${statCard("🎲 Perfil caos", chaos ? chaos.name : "—")}
    ${statCard("💸 Pendientes de pago", morosos.length ? morosos.join(", ") : "Nadie. Milagro.")}
    ${statCard("💰 Bote estimado", total ? `${total} €` : "Configúralo en admin")}
  </div>`;
}
function mainstreamScore(pred, champs, boots){
  let score=0; const champ=pred?.knockout?.champion?.[0]; if(champ) score += champs[champ]||0;
  const boot=pred?.awards?.goldenBoot?.[0]; if(boot) score += boots[boot]||0;
  return score;
}
function chaosScore(pred, champs){
  const champ=pred?.knockout?.champion?.[0]; return champ ? 100-(champs[champ]||0) : 0;
}
function renderLiveImpact(){
  const el=document.getElementById("liveImpactContainer"); if(!el) return;
  if(isEditOpen()){ el.innerHTML=`<div class="empty-state">Impacto en vivo bloqueado hasta el cierre. No vamos a dar pistas al roedor indeciso.</div>`; return; }
  const preds=state.server.predictions||[];
  if(!preds.length){ el.innerHTML=`<div class="empty-state">Sin predicciones no hay impacto. Matemáticamente impecable, emocionalmente pobre.</div>`; return; }
  const opts=WC_DATA.matches.map(m=>`<option value="${m.id}">${m.id}. ${displayTeam(m.home)} - ${displayTeam(m.away)}</option>`).join("");
  const current=document.getElementById("impactMatch")?.value || WC_DATA.matches[0].id;
  el.innerHTML=`<div class="impact-controls"><label>Partido<select id="impactMatch">${opts}</select></label></div><div id="impactResult"></div>`;
  document.getElementById("impactMatch").value=current;
  document.getElementById("impactMatch").addEventListener("change", renderImpactResult);
  renderImpactResult();
}
function renderImpactResult(){
  const el=document.getElementById("impactResult"); if(!el) return;
  const id=document.getElementById("impactMatch")?.value;
  const m=WC_DATA.matches.find(x=>String(x.id)===String(id)); if(!m) return;
  const preds=(state.server.predictions||[]).map(p=>{ const sc=p.prediction?.matchScores?.[id]; return {name:p.name, avatar:p.prediction?.meta?.avatar||participantAvatar(p.name), sc}; }).filter(x=>x.sc && x.sc.home!==null && x.sc.away!==null);
  el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Predicción</th><th>Si acierta exacto</th><th>Si acierta signo</th></tr></thead><tbody>${preds.map(p=>`<tr><td>${escapeHtml(p.avatar)} <strong>${escapeHtml(p.name)}</strong></td><td>${p.sc.home}-${p.sc.away}</td><td>+4</td><td>+2</td></tr>`).join("")}</tbody></table></div><p class="muted">Impacto simple de partido. Las tragedias de campeón muerto se calculan cuando haya resultados reales de eliminatorias.</p>`;
}
function randomRatPrediction(){
  const mode=prompt("Modo ExSys completo: conservador, caos o comité", "conservador");
  if(!mode) return;

  const isChaos = /caos/i.test(mode);
  const isRat = /(compañero|comité|excel)/i.test(mode);

  WC_DATA.matches.forEach(m=>{
    const favoriteBias = groupTeamOrder(m.home) <= groupTeamOrder(m.away) ? 1 : -1;
    let h=0,a=0;
    if(isChaos){
      h=Math.floor(Math.random()*5);
      a=Math.floor(Math.random()*5);
    } else if(isRat){
      h=Math.floor(Math.random()*4);
      a=Math.floor(Math.random()*4);
      if(Math.random()<0.18){
        h= Math.floor(Math.random()*7);
        a=Math.floor(Math.random()*2);
      }
    } else {
      h=Math.floor(Math.random()*3)+(favoriteBias>0?1:0);
      a=Math.floor(Math.random()*3)+(favoriteBias<0?1:0);
    }
    state.scores[m.id]={home:h,away:a};
  });

  restoreVisibleScores();
  syncBracketWithGroups();
  randomCompleteKnockout(mode);
  randomCompleteAwardsAndXI(mode);

  renderGroupCards();
  renderActiveStandings();
  renderBracket();
  renderProgressDashboard();
  renderMySummary();
  saveDraftLocal(true);
  toast("Predicción aleatoria ExSys activada. Si ahora falta algo, lo elevamos a incidencia con prioridad baja.", "warn");
}

function randomCompleteKnockout(mode="conservador"){
  const pickWinner = (teamA, teamB) => {
    if(!teamA) return teamB || "";
    if(!teamB) return teamA || "";

    const rankA = globalTeamStrength(teamA);
    const rankB = globalTeamStrength(teamB);
    const fav = rankA <= rankB ? teamA : teamB;
    const dog = fav === teamA ? teamB : teamA;

    if(/caos/i.test(mode)) return Math.random() < 0.50 ? teamA : teamB;
    if(/(compañero|comité|excel)/i.test(mode)) return Math.random() < 0.35 ? dog : fav;
    return Math.random() < 0.78 ? fav : dog;
  };

  // v27: simulación completa por IDs oficiales de partido.
  // No depende del render del bracket ni de clicks visuales.
  const winnersByMatchId = {};
  const losersByMatchId = {};

  const r32Slots = window.KNOCKOUT_SLOTS?.r32 || [];
  state.knockout.r32 = getQualifiedTeams();

  r32Slots.forEach((slot, i) => {
    const a = state.knockout.r32[i*2] || "";
    const b = state.knockout.r32[i*2+1] || "";
    const w = pickWinner(a,b);
    winnersByMatchId[slot.id] = w;
    losersByMatchId[slot.id] = w === a ? b : a;
  });

  const buildRound = (round) => {
    const slots = window.KNOCKOUT_SLOTS?.[round] || [];
    state.knockout[round] = [];
    slots.forEach((slot, matchIndex) => {
      const teams = (slot.from || []).map(id => winnersByMatchId[id] || "");
      state.knockout[round][matchIndex*2] = teams[0] || "";
      state.knockout[round][matchIndex*2+1] = teams[1] || "";
      const w = pickWinner(teams[0], teams[1]);
      winnersByMatchId[slot.id] = w;
      losersByMatchId[slot.id] = w === teams[0] ? teams[1] : teams[0];
    });
  };

  buildRound("r16");
  buildRound("qf");
  buildRound("sf");
  buildRound("final");

  const finalSlot = (window.KNOCKOUT_SLOTS?.final || [])[0];
  const champion = finalSlot ? winnersByMatchId[finalSlot.id] : "";
  state.knockout.champion = champion ? [champion] : [];

  const sfSlots = window.KNOCKOUT_SLOTS?.sf || [];
  const thirdCandidates = sfSlots.map(s => losersByMatchId[s.id]).filter(Boolean);
  const third = pickWinner(thirdCandidates[0], thirdCandidates[1]) || thirdCandidates[0] || "";
  state.knockout.third = third ? [third] : [];

  console.log("Predicción aleatoria ExSys completa", {
    r16: state.knockout.r16,
    qf: state.knockout.qf,
    sf: state.knockout.sf,
    final: state.knockout.final,
    champion: state.knockout.champion,
    third: state.knockout.third
  });
}

function globalTeamStrength(team){
  const power = {
    "Brazil":1, "France":2, "Argentina":3, "Spain":4, "England":5, "Portugal":6,
    "Germany":7, "Netherlands":8, "Belgium":9, "Croatia":10, "Uruguay":11,
    "Morocco":12, "United States":13, "Mexico":14, "Colombia":15, "Japan":16,
    "Switzerland":17, "Senegal":18, "Australia":19, "Korea Republic":20,
    "Türkiye":21, "Côte d’Ivoire":22, "Ecuador":23, "Paraguay":24, "Norway":25,
    "Canada":26, "Egypt":27, "Iran":28, "Algeria":29, "Ghana":30,
    "Czechia":31, "Austria":32, "Scotland":33, "Sweden":34, "Saudi Arabia":35,
    "South Africa":36, "Tunisia":37, "Qatar":38, "New Zealand":39, "Cabo Verde":40,
    "Haiti":41, "Panama":42, "Jordan":43, "Uzbekistan":44, "Bosnia and Herzegovina":45,
    "Curaçao":46, "Iraq":47, "Congo DR":48
  };
  return power[team] || 99;
}

function randomCompleteAwardsAndXI(mode="conservador"){
  const topPlayers = [
    "Kylian Mbappé", "Lionel Messi", "Lamine Yamal", "Vinícius Jr.", "Harry Kane",
    "Erling Haaland", "Jude Bellingham", "Pedri", "Rodri", "Jamal Musiala",
    "Phil Foden", "Bukayo Saka", "Lautaro Martínez", "Raphinha", "Bruno Fernandes"
  ];
  const keepers = ["Unai Simón", "Emiliano Martínez", "Mike Maignan", "Alisson", "Manuel Neuer", "Diogo Costa"];
  const young = ["Lamine Yamal", "Endrick", "Gavi", "Warren Zaïre-Emery", "Arda Güler", "Alejandro Garnacho"];
  const xi = [
    "Unai Simón",
    "Achraf Hakimi", "William Saliba", "Rúben Dias", "Theo Hernández",
    "Rodri", "Jude Bellingham", "Pedri",
    "Lamine Yamal", "Kylian Mbappé", "Vinícius Jr."
  ];
  const shuffle = arr => [...arr].sort(()=>Math.random()-0.5);
  const set = (name, value) => {
    const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
    if(el) el.value = value;
  };

  const boot = shuffle(topPlayers).slice(0,3);
  const ball = shuffle(topPlayers).slice(0,3);
  const glove = shuffle(keepers).slice(0,3);
  const bestYoung = shuffle(young).slice(0,3);
  const bestXI = /caos|compañero|comité|excel/i.test(mode) ? shuffle([...xi, ...topPlayers, ...keepers]).slice(0,11) : xi;

  boot.forEach((v,i)=>set(`goldenBoot${i+1}`, v));
  ball.forEach((v,i)=>set(`goldenBall${i+1}`, v));
  glove.forEach((v,i)=>set(`goldenGlove${i+1}`, v));
  bestYoung.forEach((v,i)=>set(`bestYoung${i+1}`, v));
  bestXI.forEach((v,i)=>set(`bestXI_${i+1}`, v));
}


/* ==============================
   v14: limpieza, criterios FIFA, cruces oficiales, tercer puesto y validaciones fuertes
   ============================== */
const V14_MAX_GOALS = 30;

function compareTeams(a,b){
  const base = (b.pts-a.pts) || (b.gd-a.gd) || (b.gf-a.gf);
  if (base !== 0) return base;
  const h = headToHeadCompare(a, b);
  if (h !== 0) return h;
  return groupTeamOrder(a.team) - groupTeamOrder(b.team) || a.team.localeCompare(b.team);
}

function groupTeamOrder(team){
  for (const g of GROUP_ORDER) {
    const idx = (WC_DATA.groups[g] || []).indexOf(team);
    if (idx >= 0) return idx;
  }
  return 99;
}

function headToHeadCompare(a,b){
  const g = a.group || b.group;
  const matches = WC_DATA.matches.filter(m => m.group === g && [m.home,m.away].includes(a.team) && [m.home,m.away].includes(b.team));
  let A={pts:0,gf:0,ga:0}, B={pts:0,gf:0,ga:0};
  matches.forEach(m => {
    const sc = state.scores[m.id] || {};
    if (sc.home === null || sc.home === undefined || sc.away === null || sc.away === undefined) return;
    const hg=Number(sc.home), ag=Number(sc.away);
    const aHome = m.home === a.team;
    const agf = aHome ? hg : ag, aga = aHome ? ag : hg;
    const bgf = aHome ? ag : hg, bga = aHome ? hg : ag;
    A.gf += agf; A.ga += aga; B.gf += bgf; B.ga += bga;
    if (agf > bgf) A.pts += 3; else if (agf < bgf) B.pts += 3; else { A.pts++; B.pts++; }
  });
  return (B.pts-A.pts) || ((B.gf-B.ga)-(A.gf-A.ga)) || (B.gf-A.gf);
}

function calculateStandings(){
  const tables = {};
  GROUP_ORDER.forEach(group => {
    tables[group] = {};
    WC_DATA.groups[group].forEach(team => tables[group][team] = { team, group, pts:0, gf:0, ga:0, gd:0, played:0 });
  });
  WC_DATA.matches.forEach(m => {
    const home = tables[m.group][m.home], away = tables[m.group][m.away];
    const h = getScoreValue(`m${m.id}_home`), a = getScoreValue(`m${m.id}_away`);
    if (h === null || a === null || Number.isNaN(h) || Number.isNaN(a)) return;
    home.played++; away.played++;
    home.gf += h; home.ga += a; away.gf += a; away.ga += h;
    home.gd = home.gf - home.ga; away.gd = away.gf - away.ga;
    if (h > a) home.pts += 3;
    else if (h < a) away.pts += 3;
    else { home.pts += 1; away.pts += 1; }
  });
  const out = {};
  GROUP_ORDER.forEach(g => out[g] = Object.values(tables[g]).sort(compareTeams));
  return out;
}

function getQualifiedTeams(){
  const tables = calculateStandings();
  const thirdCandidates = [];
  const thirdByGroup = {};
  GROUP_ORDER.forEach(g => {
    const third = tables[g]?.[2];
    if (third) { thirdCandidates.push(third); thirdByGroup[g] = third; }
  });
  thirdCandidates.sort(compareTeams);
  const bestThirdGroups = thirdCandidates.slice(0,8).map(t => t.group);
  const thirdAssignments = buildThirdAssignments(bestThirdGroups);
  const resolveToken = (token, slotIndex) => {
    if (!token) return "";
    const rank = Number(token[0]);
    const groups = token.slice(1).split("");
    if (rank === 1 || rank === 2) return tables[groups[0]]?.[rank-1]?.team || "";
    if (rank === 3) {
      const assignedGroup = thirdAssignments[slotIndex];
      if (assignedGroup && thirdByGroup[assignedGroup]) return thirdByGroup[assignedGroup].team;
      return `3º ${groups.join("/")}`;
    }
    return "";
  };
  const slots = (window.KNOCKOUT_SLOTS?.r32 || []);
  return slots.flatMap((s, i) => [resolveToken(s.a, i), resolveToken(s.b, i)]);
}

function buildThirdAssignments(bestThirdGroups){
  const slots = window.KNOCKOUT_SLOTS?.r32 || [];
  const thirdSlots = slots.map((slot, index) => ({ index, token: [slot.a, slot.b].find(t => /^3[A-L]+$/.test(t || "")) })).filter(x => x.token);
  const key = [...bestThirdGroups].sort().join("");
  const official = window.THIRD_PLACE_ASSIGNMENT_TABLE?.[key];
  if (official) {
    const out = {};
    official.forEach(item => {
      const slotIndex = thirdSlots.find(x => (slots[x.index].a || "").includes(item.winner) || (slots[x.index].b || "").includes(item.winner))?.index;
      if (slotIndex !== undefined) out[slotIndex] = item.third;
    });
    if (Object.keys(out).length === thirdSlots.length) return out;
  }

  // Fallback inteligente: no escoge "el primer tercero compatible". Hace una asignación global sin repetir grupo,
  // priorizando los huecos con menos opciones. Si algún día quieres meter las 495 combinaciones oficiales completas,
  // basta con rellenar THIRD_PLACE_ASSIGNMENT_TABLE en worldcup2026.js.
  const available = new Set(bestThirdGroups);
  const ordered = [...thirdSlots].sort((a,b) => {
    const ca = a.token.slice(1).split("").filter(g => available.has(g)).length;
    const cb = b.token.slice(1).split("").filter(g => available.has(g)).length;
    return ca - cb;
  });
  const result = {};
  function backtrack(pos){
    if (pos >= ordered.length) return true;
    const slot = ordered[pos];
    const candidates = slot.token.slice(1).split("").filter(g => available.has(g));
    for (const g of candidates){
      available.delete(g); result[slot.index] = g;
      if (backtrack(pos + 1)) return true;
      delete result[slot.index]; available.add(g);
    }
    return false;
  }
  backtrack(0);
  return result;
}

function syncBracketWithGroups(){
  const teams = getQualifiedTeams();
  state.knockout.r32 = teams;
  const r32Set = new Set(teams.filter(t => !String(t).startsWith("3º ")));
  state.knockout.r16 = (state.knockout.r16 || []).map(t => r32Set.has(t) ? t : "");
  ["qf","sf","final","champion","third"].forEach(round => state.knockout[round] ||= []);
  cleanupRound("r16","qf"); cleanupRound("qf","sf"); cleanupRound("sf","final"); cleanupRound("final","champion");
  const thirdAllowed = getThirdPlaceCandidates();
  state.knockout.third = (state.knockout.third || []).filter(t => thirdAllowed.includes(t));
}

function getThirdPlaceCandidates(){
  const semi = (state.knockout.sf || []).filter(Boolean);
  const finalists = new Set((state.knockout.final || []).filter(Boolean));
  return semi.filter(t => !finalists.has(t)).slice(0,2);
}

function stageMeta(round, index){
  const list = window.KNOCKOUT_SLOTS?.[round] || [];
  return list[index] || null;
}
function metaLine(round, index){
  const meta = stageMeta(round, index);
  if (!meta) return "";
  const date = meta.date ? new Date(meta.date + "T12:00:00").toLocaleDateString("es-ES", { day:"numeric", month:"short" }).replace(".","").toUpperCase() : "";
  return `<small class="ko-meta">${meta.id ? `Partido ${meta.id} · ` : ""}${date}${meta.city ? ` · ${escapeHtml(meta.city)}` : ""}${meta.venue ? ` · ${escapeHtml(meta.venue)}` : ""}</small>`;
}

function renderBracket(){
  const enough = groupCompletionAll() === WC_DATA.matches.length;
  const candidates3 = getThirdPlaceCandidates();
  const thirdMeta = metaLine("third",0);
  const thirdSelected = (state.knockout.third || [])[0] || "";
  const champion = (state.knockout.champion || [])[0] || "";
  const finalMeta = metaLine("final",0);
  const notice = document.getElementById("bracketNotice");
  if (notice) notice.textContent = enough
    ? "Dieciseisavos calculados desde grupos. Primeros y segundos van por cuadro FIFA; los terceros usan asignación compatible hasta cargar la matriz completa. ExSys avisa, que luego vienen los peritos del Excel."
    : "Los cruces de primeros y segundos siguen el cuadro FIFA; los terceros se colocan con asignación compatible mientras no esté cargada la matriz completa. No es magia negra, es formato FIFA.";
  const tree = document.getElementById("knockoutTree");
  if (!tree) return;
  tree.innerHTML = `
    <div id="bracketArena" class="bracket-arena v23-bracket no-svg-lines">
      <div class="bracket-side bracket-left">
        ${renderRoundByIds("r32", BRACKET_VISUAL_LAYOUT.left.r32, false, "left")}
        ${renderRoundByIds("r16", BRACKET_VISUAL_LAYOUT.left.r16, false, "left")}
        ${renderRoundByIds("qf", BRACKET_VISUAL_LAYOUT.left.qf, false, "left")}
        ${renderRoundByIds("sf", BRACKET_VISUAL_LAYOUT.left.sf, false, "left")}
      </div>
      <div class="bracket-center">
        <h3>FINAL</h3>
        ${renderRoundByIds("final", [104], true, "center")}
        <div class="winner-panel">
          <span>🏆 WINNERS</span>
          <div class="champion-box ${champion ? "selected" : ""}">${champion ? teamLine(champion) : '<span class="placeholder">Elige campeón</span>'}</div>
          ${finalMeta}
        </div>
        <div class="third-panel">
          <span>🥉 TERCER PUESTO</span>
          <p class="third-help">Se desbloquea cuando hayas elegido los finalistas. Sí, primero los finalistas y luego ya repartimos la medalla de consolación, que esto no es una tómbola.</p>
          <div class="third-options">${candidates3.length ? candidates3.map(t => `<button type="button" class="team-pick third-pick ${thirdSelected===t?'selected':''}" data-team="${escapeAttr(t)}">${teamLine(t)}</button>`).join("") : '<span class="placeholder">Saldrá de los perdedores de semifinales</span>'}</div>
          ${thirdMeta}
        </div>
      </div>
      <div class="bracket-side bracket-right">
        ${renderRoundByIds("sf", BRACKET_VISUAL_LAYOUT.right.sf, false, "right")}
        ${renderRoundByIds("qf", BRACKET_VISUAL_LAYOUT.right.qf, false, "right")}
        ${renderRoundByIds("r16", BRACKET_VISUAL_LAYOUT.right.r16, false, "right")}
        ${renderRoundByIds("r32", BRACKET_VISUAL_LAYOUT.right.r32, false, "right")}
      </div>
    </div>`;
  document.querySelectorAll(".team-pick:not(.third-pick)").forEach(btn => btn.addEventListener("click", () => selectWinner(btn.dataset.round, Number(btn.dataset.match), btn.dataset.team)));
  document.querySelectorAll(".third-pick").forEach(btn => btn.addEventListener("click", () => selectThirdPlace(btn.dataset.team)));
  // v22: las líneas SVG se desactivan para evitar que se pinten fuera del bracket en GitHub Pages.
  clearBracketLines();
}

function renderRoundByIds(round, matchIds, compact=false, side="left"){
  const source = round === "r32" ? state.knockout.r32 : (state.knockout[round] || []);
  return `<div class="bracket-round bracket-round-${round} ${compact?'compact':''}" data-round="${round}" data-side="${side}"><h3>${ROUND_LABELS[round]}</h3>${matchIds.map(id => {
    const i = getSlotIndexById(round, id);
    if (i < 0) return "";
    const a = source[i*2] || "";
    const b = source[i*2+1] || "";
    return `<div class="bracket-match" data-round="${round}" data-match="${i}" data-match-id="${id}" data-side="${side}">${metaLine(round,i)}${bracketTeam(round,i,a)}${bracketTeam(round,i,b)}</div>`;
  }).join("")}</div>`;
}

// Compatibilidad: algunas zonas antiguas pueden llamar a renderRoundSlice.
// Internamente ya se recomienda renderRoundByIds para respetar el cuadro oficial.
function renderRoundSlice(round, startMatch, endMatch, compact=false, side="left"){
  const ids = (window.KNOCKOUT_SLOTS?.[round] || []).slice(startMatch, endMatch).map(s => s.id);
  return renderRoundByIds(round, ids, compact, side);
}

function bracketTeam(round, matchIndex, team){
  if (!team) return `<button type="button" class="team-pick empty" disabled><span class="placeholder">---</span></button>`;
  const next = nextRound(round);
  const target = next ? findNextSlotPosition(round, matchIndex) : matchIndex;
  const selected = next ? (state.knockout[next] || [])[target] === team : false;
  const disabled = String(team).startsWith("3º ") ? "disabled" : "";
  return `<button type="button" class="team-pick ${selected?'selected':''}" ${disabled} data-round="${round}" data-match="${matchIndex}" data-team="${escapeAttr(team)}">${String(team).startsWith("3º ") ? `<span class="placeholder">${escapeHtml(team)}</span>` : teamLine(team)}</button>`;
}

function drawBracketLines(){
  // v22: desactivado. Las líneas SVG causaban artefactos fuera del cuadro en GitHub Pages.
  clearBracketLines();
}

function clearBracketLines(){
  document.querySelectorAll(".bracket-lines").forEach(svg => {
    svg.innerHTML = "";
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.display = "none";
  });
}

function selectWinner(round, matchIndex, team){
  const next = nextRound(round);
  if (!next) return;
  state.knockout[next] ||= [];
  const targetIndex = findNextSlotPosition(round, matchIndex);
  state.knockout[next][targetIndex] = team;
  cleanupRound("r16","qf"); cleanupRound("qf","sf"); cleanupRound("sf","final"); cleanupRound("final","champion");
  if (round === "sf") state.knockout.third = (state.knockout.third || []).filter(t => getThirdPlaceCandidates().includes(t));
  renderBracket(); scheduleDraftAutosave(); renderProgressDashboard(); renderMySummary();
}
function selectThirdPlace(team){
  state.knockout.third = [team];
  renderBracket(); scheduleDraftAutosave(); renderProgressDashboard(); renderMySummary();
}

function collectPrediction(){
  rememberVisibleScores();
  const fd = new FormData(document.getElementById("predictionForm"));
  const matchScores = {};
  WC_DATA.matches.forEach(m => {
    const sc = state.scores[m.id] || {};
    matchScores[m.id] = { home: sc.home ?? null, away: sc.away ?? null };
  });
  const standings = calculateStandings();
  const groupPositions = {};
  GROUP_ORDER.forEach(g => groupPositions[g] = (standings[g] || []).slice(0,3).map(x=>x.team));
  syncBracketWithGroups();
  return {
    matchScores,
    groupPositions,
    knockout: {
      r32: state.knockout.r32 || [],
      r16: state.knockout.r16 || [],
      qf: state.knockout.qf || [],
      sf: state.knockout.sf || [],
      finalists: state.knockout.final || [],
      champion: state.knockout.champion || [],
      third: state.knockout.third || []
    },
    meta: {
      avatar: state.avatar || "🐀"
    },
    awards: {
      goldenBoot: [fd.get("goldenBoot1"), fd.get("goldenBoot2"), fd.get("goldenBoot3")].map(clean),
      goldenBall: [fd.get("goldenBall1"), fd.get("goldenBall2"), fd.get("goldenBall3")].map(clean),
      goldenGlove: [fd.get("goldenGlove1"), fd.get("goldenGlove2"), fd.get("goldenGlove3")].map(clean),
      bestYoung: [fd.get("bestYoung1"), fd.get("bestYoung2"), fd.get("bestYoung3")].map(clean),
      bestXI: Array.from({length:11},(_,i)=>clean(fd.get(`bestXI_${i+1}`))).filter(Boolean)
    },
    updatedAt: new Date().toISOString()
  };
}

function validatePrediction(prediction){
  const missing = [];
  const ms = prediction.matchScores || {};
  const badGoals = [];
  const incompleteMatches = WC_DATA.matches.filter(m => {
    const sc = ms[m.id] || {};
    const vals = [sc.home, sc.away];
    if (vals.some(v => v === null || v === undefined || v === "")) return true;
    if (vals.some(v => !Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > V14_MAX_GOALS)) badGoals.push(`Partido ${m.id}`);
    return false;
  });
  if (incompleteMatches.length) missing.push(`${incompleteMatches.length} partidos de grupos`);
  if (badGoals.length) missing.push(`goles inválidos (${badGoals.slice(0,5).join(", ")}${badGoals.length>5?"...":""}); usa enteros entre 0 y ${V14_MAX_GOALS}`);
  const ko = prediction.knockout || {};
  [["r16",16,"octavos"],["qf",8,"cuartos"],["sf",4,"semifinales"],["finalists",2,"finalistas"],["champion",1,"campeón"],["third",1,"tercer puesto"]].forEach(([key,n,label])=>{
    if ((ko[key] || []).filter(Boolean).length < n) missing.push(label);
  });
  const aw = prediction.awards || {};
  [["goldenBall","Balón de Oro"],["goldenBoot","Bota de Oro"],["goldenGlove","Guante de Oro"],["bestYoung","Mejor joven"]].forEach(([key,label])=>{
    if ((aw[key] || []).filter(Boolean).length < 3) missing.push(label);
  });
  if ((aw.bestXI || []).filter(Boolean).length < 11) missing.push("11 ideal completo");
  return { ok: missing.length === 0, missing };
}

function progressData(prediction=null){
  const pred = prediction || collectPredictionSafe();
  const matchDone = Object.values(pred.matchScores || {}).filter(sc => sc.home !== null && sc.away !== null && sc.home !== undefined && sc.away !== undefined).length;
  const ko = pred.knockout || {};
  const koDone = [(ko.r16||[]).filter(Boolean).length,(ko.qf||[]).filter(Boolean).length,(ko.sf||[]).filter(Boolean).length,(ko.finalists||[]).filter(Boolean).length,(ko.champion||[]).filter(Boolean).length,(ko.third||[]).filter(Boolean).length].reduce((a,b)=>a+b,0);
  const aw = pred.awards || {};
  const awardsDone = ["goldenBall","goldenBoot","goldenGlove","bestYoung"].reduce((acc,k)=>acc+(aw[k]||[]).filter(Boolean).length,0);
  const xiDone = (aw.bestXI || []).filter(Boolean).length;
  return { matchDone, matchTotal: WC_DATA.matches.length, koDone, koTotal: 32, awardsDone, awardsTotal: 12, xiDone, xiTotal: 11 };
}

function sectionProgress(){
  const p = progressData();
  return { matchesDone:p.matchDone, totalMatches:p.matchTotal, koDone:p.koDone, koTotal:p.koTotal, awardsDone:p.awardsDone, awardsTotal:p.awardsTotal, xiDone:p.xiDone, xiTotal:p.xiTotal };
}

function showReviewModal(prediction){
  const msDone = Object.values(prediction.matchScores || {}).filter(sc => sc.home !== null && sc.away !== null && sc.home !== undefined && sc.away !== undefined).length;
  const ko = prediction.knockout || {}, aw = prediction.awards || {};
  const champion = (ko.champion || [])[0] || "—";
  const finalists = (ko.finalists || ko.final || []).filter(Boolean).join(" vs ") || "—";
  const third = (ko.third || [])[0] || "—";
  const review = document.getElementById("reviewSummary");
  if (review) review.innerHTML = `
    <div class="review-warning">👀 Último vistazo. Si después dices “yo no puse eso”, esta pantalla declarará en tu contra.</div>
    <div class="review-grid">
      <div><span class="label">Jugador</span><strong>${escapeHtml(state.player)}</strong></div>
      <div><span class="label">Partidos fase grupos</span><strong>${msDone}/${WC_DATA.matches.length}</strong></div>
      <div><span class="label">Final</span><strong>${escapeHtml(finalists)}</strong></div>
      <div><span class="label">Campeón</span><strong>${escapeHtml(displayTeam(champion))}</strong></div>
      <div><span class="label">Tercer puesto</span><strong>${escapeHtml(displayTeam(third))}</strong></div>
      <div><span class="label">Balón de Oro</span><strong>${escapeHtml((aw.goldenBall || []).filter(Boolean).join(", "))}</strong></div>
      <div><span class="label">Bota de Oro</span><strong>${escapeHtml((aw.goldenBoot || []).filter(Boolean).join(", "))}</strong></div>
      <div><span class="label">Guante de Oro</span><strong>${escapeHtml((aw.goldenGlove || []).filter(Boolean).join(", "))}</strong></div>
      <div><span class="label">Mejor joven</span><strong>${escapeHtml((aw.bestYoung || []).filter(Boolean).join(", "))}</strong></div>
      <div><span class="label">11 ideal</span><strong>${(aw.bestXI || []).filter(Boolean).length}/11 jugadores</strong></div>
    </div>`;
  document.getElementById("reviewModal")?.classList.remove("hidden");
}

function renderMySummary(){
  const container = document.getElementById("mySummaryContainer");
  if (!container) return;
  const pred = collectPredictionSafe();
  const ko = pred.knockout || {}, aw = pred.awards || {}, groupPositions = pred.groupPositions || {};
  const champion = (ko.champion || [])[0] || "—";
  const finalists = (ko.finalists || []).filter(Boolean);
  const third = (ko.third || [])[0] || "—";
  container.innerHTML = `
    <div class="summary-hero">
      <div><span>Campeón</span><strong>${teamNameWithFlag(champion)}</strong></div>
      <div><span>Final</span><strong>${finalists.length ? finalists.map(teamNameWithFlag).join(" <em>vs</em> ") : "—"}</strong></div>
      <div><span>Tercer puesto</span><strong>${teamNameWithFlag(third)}</strong></div>
    </div>
    <div class="summary-grid">
      <div class="summary-box"><h3>🌍 Top 3 grupos</h3>${GROUP_ORDER.map(g=>`<p><b>Grupo ${g}</b> ${(groupPositions[g]||[]).slice(0,3).map(teamNameWithFlag).join(" · ") || "—"}</p>`).join("")}</div>
      <div class="summary-box"><h3>⭐ Premios</h3>
        <p><b>Balón de Oro:</b> ${(aw.goldenBall||[]).filter(Boolean).join(" · ") || "—"}</p>
        <p><b>Bota de Oro:</b> ${(aw.goldenBoot||[]).filter(Boolean).join(" · ") || "—"}</p>
        <p><b>Guante de Oro:</b> ${(aw.goldenGlove||[]).filter(Boolean).join(" · ") || "—"}</p>
        <p><b>Mejor joven:</b> ${(aw.bestYoung||[]).filter(Boolean).join(" · ") || "—"}</p>
      </div>
      <div class="summary-box wide"><h3>⚽ 11 ideal</h3><div class="summary-xi">${(aw.bestXI||[]).filter(Boolean).map(x=>`<span>${escapeHtml(x)}</span>`).join("") || "<p class='muted'>Aún no has completado el 11 ideal.</p>"}</div></div>
    </div>`;
}

function isApiReady(){
  return APP_CONFIG.API_URL && APP_CONFIG.API_URL.startsWith("http");
}
async function api(action, payload={}){
  if (!isApiReady()) throw new Error("API_URL pendiente: cuando creemos Google Apps Script, pega aquí la URL /exec en config.js. Ahora mismo estás en modo maqueta/local.");
  const res = await fetch(APP_CONFIG.API_URL, { method: "POST", body: JSON.stringify({ action, ...payload }) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error desconocido");
  return data;
}
