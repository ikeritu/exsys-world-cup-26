
const $ = (sel, root=document) => root.querySelector(sel);

let adminState = { results:{}, awards:{}, ranking:[], history:[], participants:[], pot:{} };

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("admin-locked");
  $("#adminKey").value = "";
  renderAdminResults();
  renderAwardsInputs();
  $("#loadAdminBtn").addEventListener("click", loadAdmin);
  $("#saveResultsBtn").addEventListener("click", saveResults);
  $("#saveAwardsBtn").addEventListener("click", saveAwards);
  $("#resetPinBtn").addEventListener("click", resetPin);
  $("#deleteUserBtn").addEventListener("click", deleteUser);
  $("#exportRankingBtn")?.addEventListener("click", exportRankingCsv);
  $("#exportHistoryBtn")?.addEventListener("click", exportHistoryCsv);
  $("#calcR32Btn")?.addEventListener("click", calculateRealR32FromInputs);
  $("#saveParticipantsBtn")?.addEventListener("click", saveParticipants);
  $("#savePotBtn")?.addEventListener("click", savePot);
  ["#potEntryFee","#potFirst","#potSecond","#potThird"].forEach(sel => $(sel)?.addEventListener("input", renderPotPreview));
});


/* Función duplicada eliminada en v14: isApiReady */



async function sha256Hex(text){
  const bytes = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
}

async function isLocalAdminKeyValid(key){
  return Boolean(APP_CONFIG.ADMIN_KEY_HASH) && await sha256Hex(key) === APP_CONFIG.ADMIN_KEY_HASH;
}

async function loadAdmin(){
  const key = $("#adminKey").value.trim();

  if (!isApiReady()) {
    if (!(await isLocalAdminKeyValid(key))) {
      document.body.classList.add("admin-locked");
      return msg("Clave admin incorrecta. Ni Seguridad Corporativa te deja pasar con eso.", false);
    }
    document.body.classList.remove("admin-locked");
    fillResults();
    fillAwards();
    renderAdminParticipants();
    fillPot();
    renderHistory();
    return msg("Panel desbloqueado en modo local. Falta configurar Google Sheets/API_URL para guardar datos reales.", true);
  }

  try{
    const data = await api("adminGetState");
    adminState.results = data.results || {};
    adminState.awards = data.awards || {};
    adminState.ranking = data.ranking || [];
    adminState.history = data.history || [];
    adminState.participants = data.participants || [];
    adminState.pot = data.pot || {};
    document.body.classList.remove("admin-locked");
    fillResults();
    fillAwards();
    renderAdminParticipants();
    fillPot();
    renderHistory();
    msg("Panel desbloqueado. Datos cargados.", true);
  }catch(e){
    document.body.classList.add("admin-locked");
    msg(e.message, false);
  }
}

function renderAdminResults(){
  const byGroup = WC_DATA.matches.reduce((acc,m)=>{ (acc[m.group] ||= []).push(m); return acc; }, {});
  $("#adminResultsContainer").innerHTML = `<div class="admin-results-list">${Object.keys(byGroup).sort().map(g => `
    <details class="admin-group" open>
      <summary>Grupo ${g}</summary>
      ${byGroup[g].map(m => `
        <div class="result-row" data-match-id="${m.id}">
          <strong>${m.id}. ${escapeHtml(m.home)} - ${escapeHtml(m.away)}</strong>
          <input type="number" min="0" id="r${m.id}_home" placeholder="L" />
          <input type="number" min="0" id="r${m.id}_away" placeholder="V" />
        </div>
      `).join("")}
    </details>
  `).join("")}</div>`;
}

const XI_POSITIONS = [
  "POR · Portero",
  "LD · Lateral derecho",
  "DFC · Central derecho",
  "DFC · Central izquierdo",
  "LI · Lateral izquierdo",
  "MC · Medio derecho",
  "MC · Medio centro",
  "MC · Medio izquierdo",
  "ED · Extremo derecho",
  "DC · Delantero centro",
  "EI · Extremo izquierdo"
];

function renderAwardsInputs(){
  $("#realBestXIContainer").innerHTML = XI_POSITIONS.map((label,i)=>`
    <label>${label}
      <input id="realBestXI${i+1}" placeholder="Nombre del jugador" />
    </label>
  `).join("");
}

function fillResults(){
  Object.entries(adminState.results || {}).forEach(([id, sc]) => {
    const h = $(`#r${id}_home`);
    const a = $(`#r${id}_away`);
    if (h) h.value = sc.home ?? "";
    if (a) a.value = sc.away ?? "";
  });
}

function setVal(sel, value){ const el = $(sel); if (el) el.value = value || ""; }
function splitList(value){ return String(value || "").split(",").map(x=>x.trim()).filter(Boolean); }
function fillAwards(){
  const aw = adminState.awards || {};
  const ko = aw.knockoutReal || {};
  setVal("#realKoR32", (ko.r32 || []).join(", "));
  setVal("#realKoR16", (ko.r16 || []).join(", "));
  setVal("#realKoQF", (ko.qf || []).join(", "));
  setVal("#realKoSF", (ko.sf || []).join(", "));
  setVal("#realKoFinalists", (ko.finalists || []).join(", "));
  setVal("#realKoChampion", (ko.champion || []).join(", "));
  setVal("#realKoThird", (ko.third || []).join(", "));
  (aw.goldenBoot || []).forEach((v,i)=>$("#realGoldenBoot"+(i+1)).value = v || "");
  (aw.goldenBall || []).forEach((v,i)=>$("#realGoldenBall"+(i+1)).value = v || "");
  (aw.goldenGlove || []).forEach((v,i)=>$("#realGoldenGlove"+(i+1)).value = v || "");
  (aw.bestYoung || []).forEach((v,i)=>$("#realBestYoung"+(i+1)).value = v || "");
  (aw.bestXI || []).forEach((v,i)=>$("#realBestXI"+(i+1)).value = v || "");
}


function getAdminResultsFromInputs(){
  const results = {};
  WC_DATA.matches.forEach(m => {
    const h = $(`#r${m.id}_home`)?.value;
    const a = $(`#r${m.id}_away`)?.value;
    if (h !== "" && a !== "" && h !== undefined && a !== undefined) results[m.id] = { home:Number(h), away:Number(a) };
  });
  return results;
}

/* Función duplicada eliminada en v14: compareTeamsAdmin */


/* Función duplicada eliminada en v14: calculateStandingsFromResults */


/* Función duplicada eliminada en v14: getRealR32FromResults */


/* Función duplicada eliminada en v14: calculateRealR32FromInputs */


async function saveResults(){
  const results = getAdminResultsFromInputs();
  try{
    await api("adminSaveResults", { results });
    try { if (Object.keys(results).length === WC_DATA.matches.length) calculateRealR32FromInputs(); } catch(_) {}
    msg("Resultados guardados y ranking recalculado.", true);
  }catch(e){ msg(e.message, false); }
}

async function saveAwards(){
  if (!$("#realKoR32")?.value.trim()) {
    try { calculateRealR32FromInputs(); } catch(_) {}
  }
  const awards = {
    goldenBoot: [1,2,3].map(i => $("#realGoldenBoot"+i).value.trim()),
    goldenBall: [1,2,3].map(i => $("#realGoldenBall"+i).value.trim()),
    goldenGlove: [1,2,3].map(i => $("#realGoldenGlove"+i).value.trim()),
    bestYoung: [1,2,3].map(i => $("#realBestYoung"+i).value.trim()),
    bestXI: Array.from({length:11},(_,i)=>$("#realBestXI"+(i+1)).value.trim()).filter(Boolean),
    knockoutReal: {
      r32: splitList($("#realKoR32")?.value),
      r16: splitList($("#realKoR16")?.value),
      qf: splitList($("#realKoQF")?.value),
      sf: splitList($("#realKoSF")?.value),
      finalists: splitList($("#realKoFinalists")?.value),
      champion: splitList($("#realKoChampion")?.value),
      third: splitList($("#realKoThird")?.value)
    }
  };
  try{
    await api("adminSaveAwards", { awards });
    msg("Premios guardados y ranking recalculado.", true);
  }catch(e){ msg(e.message, false); }
}

async function resetPin(){
  const name = $("#resetName").value.trim();
  if (!name) return msg("Escribe el nombre del jugador.", false);
  if (!confirm(`¿Resetear el PIN de ${name}?`)) return;
  try{
    await api("adminResetPin", { name });
    msg("PIN reseteado. El jugador podrá crear uno nuevo.", true);
  }catch(e){ msg(e.message, false); }
}

async function deleteUser(){
  const name = $("#deleteName").value.trim();
  if (!name) return msg("Escribe el nombre del jugador que quieres borrar.", false);
  if (!confirm(`¿Borrar definitivamente a ${name} y su predicción? Esta acción no se puede deshacer.`)) return;
  try{
    await api("adminDeleteUser", { name });
    msg("Usuario y predicción borrados. Ranking recalculado.", true);
  }catch(e){ msg(e.message, false); }
}


function renderHistory(){
  const rows = adminState.history || [];
  const el = $("#historyContainer");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<p class="muted">Todavía no hay historial de cambios.</p>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Jugador</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
    ${rows.slice().reverse().slice(0,80).map(r => `<tr><td>${escapeHtml(formatDateTime(r.updatedAt || r.timestamp))}</td><td><strong>${escapeHtml(r.name || "")}</strong></td><td>${escapeHtml(r.action || "")}</td><td>${escapeHtml(r.detail || "")}</td></tr>`).join("")}
  </tbody></table></div>`;
}

function exportRankingCsv(){
  const rows = adminState.ranking || [];
  if (!rows.length) return msg("Carga datos primero o todavía no hay ranking.", false);
  downloadCsv("ranking-exsys-world-cup.csv", ["posicion","jugador","total","grupos","eliminatorias","premios","actualizado"], rows.map((r,i)=>[i+1,r.name,r.total,r.groupPoints,r.koPoints,r.awardPoints,r.updatedAt]));
}
function exportHistoryCsv(){
  const rows = adminState.history || [];
  if (!rows.length) return msg("Carga datos primero o todavía no hay historial.", false);
  downloadCsv("historial-exsys-world-cup.csv", ["fecha","jugador","accion","detalle"], rows.map(r=>[r.updatedAt || r.timestamp,r.name,r.action,r.detail]));
}
function downloadCsv(filename, headers, rows){
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
function csvCell(v){
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

function renderAdminParticipants(){
  const el=$("#adminParticipantsContainer"); if(!el) return;
  const rows=adminState.participants || [];
  if(!rows.length){ el.innerHTML=`<p class="muted">Carga datos para ver participantes. De momento ExSys mira una sala de reuniones vacía.</p>`; return; }
  el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Avatar</th><th>Pagado</th><th>Predicción</th><th>Historial</th></tr></thead><tbody>${rows.map((p,i)=>`
    <tr data-player="${escapeAttr(p.name)}"><td><strong>${escapeHtml(p.name)}</strong></td><td><select class="admin-avatar" data-i="${i}"><option>🐀</option><option>🧀</option><option>💸</option><option>⚽</option><option>😭</option></select></td><td><input type="checkbox" class="admin-paid" data-i="${i}" ${String(p.paid).toLowerCase()==="true"||p.paid===true?'checked':''}></td><td>${p.hasPrediction?'✅ enviada':'🟡 pendiente'}</td><td><button type="button" class="button secondary small player-history-btn" data-name="${escapeAttr(p.name)}">Ver historial</button></td></tr>`).join("")}</tbody></table></div><div id="playerHistoryDetail" class="history-container"></div>`;
  rows.forEach((p,i)=>{ const sel=el.querySelector(`.admin-avatar[data-i="${i}"]`); if(sel) sel.value=p.avatar||"🐀"; });
  el.querySelectorAll(".player-history-btn").forEach(btn=>btn.addEventListener("click",()=>renderPlayerHistory(btn.dataset.name)));
}
function renderPlayerHistory(name){
  const el=$("#playerHistoryDetail"); if(!el) return;
  const rows=(adminState.history||[]).filter(r=>String(r.name||"").toLowerCase()===String(name||"").toLowerCase()).slice().reverse();
  if(!rows.length){ el.innerHTML=`<p class="muted">${escapeHtml(name)} no tiene historial. O es muy limpio o todavía no ha tocado nada.</p>`; return; }
  el.innerHTML=`<h3>🕒 Historial de ${escapeHtml(name)}</h3><ul class="player-history-list">${rows.map(r=>`<li><strong>${escapeHtml(formatDateTime(r.updatedAt||r.timestamp))}</strong> · ${escapeHtml(r.action||"")} · <span>${escapeHtml(r.detail||"")}</span></li>`).join("")}</ul>`;
}
async function saveParticipants(){
  const rows=(adminState.participants||[]).map((p,i)=>({
    name:p.name,
    paid:!!document.querySelector(`.admin-paid[data-i="${i}"]`)?.checked,
    avatar:document.querySelector(`.admin-avatar[data-i="${i}"]`)?.value || p.avatar || "🐀"
  }));
  try{ await api("adminSaveParticipants", { participants: rows }); adminState.participants=rows; msg("Participantes guardados. Morosos señalados con cariño administrativo.", true); }
  catch(e){ msg(e.message,false); }
}
function fillPot(){
  const p=adminState.pot||{}; setVal("#potEntryFee", p.entryFee || 10); setVal("#potFirst", p.firstPct || 70); setVal("#potSecond", p.secondPct || 20); setVal("#potThird", p.thirdPct || 10); renderPotPreview();
}
function renderPotPreview(){
  const el=$("#potPreview"); if(!el) return;
  const n=(adminState.participants||[]).length, entry=Number($("#potEntryFee")?.value||0), total=n*entry;
  const p1=Number($("#potFirst")?.value||0), p2=Number($("#potSecond")?.value||0), p3=Number($("#potThird")?.value||0);
  el.innerHTML=`<div class="receipt-grid"><div><span>Participantes</span><strong>${n}</strong></div><div><span>Total bote</span><strong>${total.toFixed(2)} €</strong></div><div><span>1º</span><strong>${(total*p1/100).toFixed(2)} €</strong></div><div><span>2º</span><strong>${(total*p2/100).toFixed(2)} €</strong></div><div><span>3º</span><strong>${(total*p3/100).toFixed(2)} €</strong></div></div>`;
}
async function savePot(){
  const pot={ entryFee:Number($("#potEntryFee")?.value||0), firstPct:Number($("#potFirst")?.value||0), secondPct:Number($("#potSecond")?.value||0), thirdPct:Number($("#potThird")?.value||0) };
  try{ await api("adminSavePot", { pot }); adminState.pot=pot; renderPotPreview(); msg("Bote guardado. ExSys también sabe de tesorería, aunque no lo parezca.", true); }
  catch(e){ msg(e.message,false); }
}

function formatDateTime(iso){
  return iso ? new Date(iso).toLocaleString("es-ES") : "";
}

function msg(text, ok){
  const el = $("#adminMsg");
  el.textContent = text;
  el.className = "message " + (ok ? "ok" : "err");
}
function escapeHtml(str){ return String(str ?? "").replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }


/* v14 admin: cruces oficiales, desempates alineados y mensaje API_URL */
function isApiReady(){ return APP_CONFIG.API_URL && APP_CONFIG.API_URL.startsWith("http"); }
async function api(action, payload={}){
  if (!isApiReady()) throw new Error("API_URL pendiente: primero crea Google Apps Script y pega la URL /exec en config.js.");
  const res = await fetch(APP_CONFIG.API_URL, { method:"POST", body: JSON.stringify({ action, adminKey: document.getElementById("adminKey").value, ...payload }) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error desconocido");
  return data;
}
function escapeAttr(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}
function compareTeamsAdmin(a,b){
  const base = (b.pts-a.pts) || (b.gd-a.gd) || (b.gf-a.gf);
  if (base !== 0) return base;
  const h = headToHeadCompareAdmin(a,b);
  if (h !== 0) return h;
  return adminTeamOrder(a.team) - adminTeamOrder(b.team) || String(a.team).localeCompare(String(b.team));
}
function adminTeamOrder(team){ for (const g of Object.keys(WC_DATA.groups).sort()) { const idx=(WC_DATA.groups[g]||[]).indexOf(team); if (idx>=0) return idx; } return 99; }
function headToHeadCompareAdmin(a,b){
  const g = a.group || b.group;
  let A={pts:0,gf:0,ga:0}, B={pts:0,gf:0,ga:0};
  WC_DATA.matches.filter(m => m.group===g && [m.home,m.away].includes(a.team) && [m.home,m.away].includes(b.team)).forEach(m => {
    const sc = getAdminResultsFromInputs()[m.id]; if (!sc) return;
    const hg=Number(sc.home), ag=Number(sc.away), aHome=m.home===a.team;
    const agf=aHome?hg:ag, bgf=aHome?ag:hg;
    A.gf+=agf; A.ga+=bgf; B.gf+=bgf; B.ga+=agf;
    if (agf>bgf) A.pts+=3; else if (agf<bgf) B.pts+=3; else {A.pts++;B.pts++;}
  });
  return (B.pts-A.pts) || ((B.gf-B.ga)-(A.gf-A.ga)) || (B.gf-A.gf);
}
function calculateStandingsFromResults(results){
  const groups = {};
  WC_DATA.matches.forEach(m => {
    const g=m.group; groups[g] ||= {};
    [m.home,m.away].forEach(t => groups[g][t] ||= { team:t, group:g, pts:0, gf:0, ga:0, gd:0 });
    const sc = results[m.id]; if (!sc || sc.home === null || sc.away === null || Number.isNaN(sc.home) || Number.isNaN(sc.away)) return;
    const h=Number(sc.home), a=Number(sc.away);
    groups[g][m.home].gf+=h; groups[g][m.home].ga+=a; groups[g][m.away].gf+=a; groups[g][m.away].ga+=h;
    groups[g][m.home].gd=groups[g][m.home].gf-groups[g][m.home].ga; groups[g][m.away].gd=groups[g][m.away].gf-groups[g][m.away].ga;
    if(h>a) groups[g][m.home].pts+=3; else if(h<a) groups[g][m.away].pts+=3; else {groups[g][m.home].pts++; groups[g][m.away].pts++;}
  });
  const out={}; Object.keys(groups).sort().forEach(g => out[g]=Object.values(groups[g]).sort(compareTeamsAdmin)); return out;
}
function buildThirdAssignmentsAdmin(bestThirdGroups){
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
  const available = new Set(bestThirdGroups);
  const ordered = [...thirdSlots].sort((a,b) => {
    const ca = a.token.slice(1).split("").filter(g => available.has(g)).length;
    const cb = b.token.slice(1).split("").filter(g => available.has(g)).length;
    return ca - cb;
  });
  const result = {};
  function backtrack(pos){
    if (pos >= ordered.length) return true;
    const item = ordered[pos];
    const candidates = item.token.slice(1).split("").filter(g => available.has(g));
    for (const g of candidates) {
      available.delete(g);
      result[item.index] = g;
      if (backtrack(pos+1)) return true;
      delete result[item.index];
      available.add(g);
    }
    return false;
  }
  backtrack(0);
  return result;
}

function getRealR32FromResults(results){
  const totalMatches = WC_DATA.matches.length;
  if (Object.keys(results).length < totalMatches) throw new Error(`Faltan resultados de grupos: ${Object.keys(results).length}/${totalMatches}.`);
  const tables = calculateStandingsFromResults(results);
  const thirds=[];
  const thirdByGroup={};
  Object.keys(tables).sort().forEach(g => { if(tables[g]?.[2]) { thirds.push(tables[g][2]); thirdByGroup[g]=tables[g][2]; } });
  thirds.sort(compareTeamsAdmin);
  const bestThirdGroups = new Set(thirds.slice(0,8).map(t=>t.group));
  const thirdAssignments = buildThirdAssignmentsAdmin(bestThirdGroups);
  const resolve = (token, slotIndex) => {
    const rank=Number(token[0]), groups=token.slice(1).split("");
    if(rank===1 || rank===2) return tables[groups[0]]?.[rank-1]?.team || "";
    const assignedGroup = thirdAssignments[slotIndex];
    if(assignedGroup && thirdByGroup[assignedGroup]) return thirdByGroup[assignedGroup].team;
    return "";
  };
  return (window.KNOCKOUT_SLOTS?.r32 || []).flatMap((slot, i) => [resolve(slot.a, i), resolve(slot.b, i)]).filter(Boolean);
}
function calculateRealR32FromInputs(){
  try{
    const teams = getRealR32FromResults(getAdminResultsFromInputs());
    document.getElementById("realKoR32").value = teams.join(", ");
    msg("Dieciseisavos reales calculados con la misma asignación de terceros que ve el jugador. ExSys, por una vez, no se contradice.", true);
    return teams;
  }catch(e){ msg(e.message, false); return []; }
}
