
/**
 * Backend Google Apps Script para:
 * ExSys World Cup 26
 *
 * Pasos:
 * 1. Crear Google Sheet.
 * 2. Extensiones > Apps Script.
 * 3. Pegar este archivo como Code.gs.
 * 4. Configura ADMIN_PIN en Propiedades del script. No lo dejes escrito en el código público.
 * 5. Ejecutar setup() una vez.
 * 6. Implementar > Nueva implementación > Aplicación web.
 *    - Ejecutar como: tú mismo
 *    - Quién tiene acceso: cualquiera con el enlace
 * 7. Copiar la URL /exec en config.js -> API_URL.
 */

const ADMIN_PIN_PROPERTY = "ADMIN_PIN";

function getAdminPin_() {
  return PropertiesService.getScriptProperties().getProperty(ADMIN_PIN_PROPERTY) || "";
}

function setupAdminPinOnce() {
  // Ejecuta esta función una vez desde Apps Script. Para esta bolilla el PIN admin definitivo es 2226.
  PropertiesService.getScriptProperties().setProperty(ADMIN_PIN_PROPERTY, "2226");
}
const SHEETS = {
  users: "Usuarios",
  predictions: "Predicciones",
  results: "Resultados",
  awards: "Premios",
  ranking: "Ranking",
  logs: "Logs",
  history: "Historial",
  participants: "Participantes",
  pot: "Bote"
};

function setup() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, SHEETS.users, ["nameKey","name","pinHash","createdAt","updatedAt","pinReset","paid","avatar"]);
  ensureSheet_(ss, SHEETS.predictions, ["nameKey","name","predictionJson","createdAt","updatedAt"]);
  ensureSheet_(ss, SHEETS.results, ["key","json","updatedAt"]);
  ensureSheet_(ss, SHEETS.awards, ["key","json","updatedAt"]);
  ensureSheet_(ss, SHEETS.ranking, ["name","total","groupPoints","koPoints","awardPoints","updatedAt"]);
  ensureSheet_(ss, SHEETS.logs, ["timestamp","action","name","detail"]);
  ensureSheet_(ss, SHEETS.history, ["updatedAt","nameKey","name","action","detail","oldJson","newJson"]);
  ensureSheet_(ss, SHEETS.participants, ["nameKey","name","paid","avatar","updatedAt"]);
  ensureSheet_(ss, SHEETS.pot, ["key","json","updatedAt"]);
}

function doPost(e) {
  try {
    setup();
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;
    let out;
    if (action === "login") out = login_(body);
    else if (action === "getState") out = getState_(body);
    else if (action === "savePrediction") out = savePrediction_(body);
    else if (action === "adminGetState") out = adminGetState_(body);
    else if (action === "adminSaveResults") out = adminSaveResults_(body);
    else if (action === "adminSaveAwards") out = adminSaveAwards_(body);
    else if (action === "adminResetPin") out = adminResetPin_(body);
    else if (action === "adminDeleteUser") out = adminDeleteUser_(body);
    else if (action === "adminSaveParticipants") out = adminSaveParticipants_(body);
    else if (action === "adminSavePot") out = adminSavePot_(body);
    else throw new Error("Acción no reconocida: " + action);
    return json_({ ok: true, ...out });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function login_(body) {
  const name = cleanName_(body.name);
  const pin = String(body.pin || "");
  const mode = String(body.mode || "register");
  if (!name || !pin) throw new Error("Nombre y PIN son obligatorios.");
  const user = findUser_(name);
  const pinHash = hash_(pin);
  if (!user) {
    if (mode === "edit") throw new Error("No existe ningún jugador con ese nombre. Usa 'Nuevo usuario' para crearlo.");
    appendRow_(SHEETS.users, [keyName_(name), name, pinHash, now_(), now_(), "", "", body.avatar || "🐀"]);
    upsertParticipant_(name, { avatar: body.avatar || "🐀" });
    log_("login:create", name, "Usuario creado");
    appendHistory_(name, "usuario creado", "Alta de nuevo jugador", "", "");
    return { name, created: true, prediction: null, avatar: body.avatar || "🐀" };
  }
  if (String(user.pinReset).toLowerCase() === "true") {
    updateUser_(name, { pinHash, pinReset: "", updatedAt: now_() });
    log_("login:reset", name, "PIN recreado tras reset");
    appendHistory_(name, "pin recreado", "Jugador crea nuevo PIN tras reset admin", "", "");
    return { name: user.name, created: false, prediction: getPrediction_(name), avatar: user.avatar || "🐀" };
  }
  if (mode === "register") throw new Error("Ese nombre ya existe. Usa 'Editar predicción' e introduce su PIN.");
  if (user.pinHash !== pinHash) throw new Error("PIN incorrecto para ese nombre.");
  return { name: user.name, created: false, prediction: getPrediction_(name), avatar: user.avatar || "🐀" };
}

function savePrediction_(body) {
  const name = cleanName_(body.name);
  requireUserPin_(name, body.pin);
  const prediction = body.prediction;
  if (!prediction) throw new Error("No se ha recibido ninguna predicción.");
  upsertPrediction_(name, prediction);
  recalcRanking_();
  log_("prediction:save", name, "Predicción guardada");
  return { saved: true };
}

function getState_(body) {
  const name = cleanName_(body.name);
  requireUserPin_(name, body.pin);
  const myPrediction = getPrediction_(name);
  const canSeePredictions = !!myPrediction;
  return {
    myPrediction,
    predictions: canSeePredictions ? listPredictions_() : [],
    results: getJsonCell_(SHEETS.results, "results", {}),
    awards: getJsonCell_(SHEETS.awards, "awards", {}),
    ranking: listRanking_(),
    history: listHistory_(),
    participants: listParticipants_(),
    pot: getJsonCell_(SHEETS.pot, "pot", { entryFee: 10, firstPct: 70, secondPct: 20, thirdPct: 10 })
  };
}

function adminGetState_(body) {
  requireAdmin_(body.adminKey);
  return {
    predictions: listPredictions_(),
    results: getJsonCell_(SHEETS.results, "results", {}),
    awards: getJsonCell_(SHEETS.awards, "awards", {}),
    ranking: listRanking_(),
    history: listHistory_(),
    participants: listParticipants_(),
    pot: getJsonCell_(SHEETS.pot, "pot", { entryFee: 10, firstPct: 70, secondPct: 20, thirdPct: 10 })
  };
}

function adminSaveResults_(body) {
  requireAdmin_(body.adminKey);
  setJsonCell_(SHEETS.results, "results", body.results || {});
  recalcRanking_();
  log_("admin:results", "ADMIN", "Resultados guardados");
  return { saved: true };
}

function adminSaveAwards_(body) {
  requireAdmin_(body.adminKey);
  setJsonCell_(SHEETS.awards, "awards", body.awards || {});
  recalcRanking_();
  log_("admin:awards", "ADMIN", "Premios guardados");
  return { saved: true };
}

function adminResetPin_(body) {
  requireAdmin_(body.adminKey);
  const name = cleanName_(body.name);
  const user = findUser_(name);
  if (!user) throw new Error("No existe ese jugador.");
  updateUser_(name, { pinHash: "", pinReset: "true", updatedAt: now_() });
  log_("admin:resetPin", name, "PIN reseteado");
  appendHistory_(name, "pin reseteado", "Admin resetea PIN", "", "");
  return { reset: true };
}

function adminDeleteUser_(body) {
  requireAdmin_(body.adminKey);
  const name = cleanName_(body.name);
  const user = findUser_(name);
  if (!user) throw new Error("No existe ese jugador.");
  deleteRowsByKey_(SHEETS.users, keyName_(name));
  deleteRowsByKey_(SHEETS.predictions, keyName_(name));
  deleteRowsByKey_(SHEETS.participants, keyName_(name));
  recalcRanking_();
  log_("admin:deleteUser", name, "Usuario y predicción borrados");
  appendHistory_(name, "usuario borrado", "Admin borra usuario y predicción", "", "");
  return { deleted: true };
}

function deleteRowsByKey_(sheetName, key) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === key) sh.deleteRow(i + 1);
  }
}

function recalcRanking_() {
  const predictions = listPredictions_();
  const results = getJsonCell_(SHEETS.results, "results", {});
  const awards = getJsonCell_(SHEETS.awards, "awards", {});
  const rows = predictions.map(p => {
    const points = scorePrediction_(p.prediction, results, awards);
    return { name: p.name, ...points, updatedAt: now_() };
  }).sort((a,b) => b.total - a.total || a.name.localeCompare(b.name));

  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ranking);
  sh.clearContents();
  sh.appendRow(["name","total","groupPoints","koPoints","awardPoints","updatedAt"]);
  rows.forEach(r => sh.appendRow([r.name, r.total, r.groupPoints, r.koPoints, r.awardPoints, r.updatedAt]));
}

function scorePrediction_(prediction, results, awards) {
  let groupPoints = 0, koPoints = 0, awardPoints = 0;
  prediction = prediction || {};

  const matchScores = prediction.matchScores || {};
  Object.keys(results || {}).forEach(id => {
    const real = results[id];
    const pred = matchScores[id];
    if (!real || !pred || pred.home === null || pred.away === null) return;
    if (Number(pred.home) === Number(real.home) && Number(pred.away) === Number(real.away)) {
      groupPoints += 4;
    } else if (sign_(pred.home, pred.away) === sign_(real.home, real.away)) {
      groupPoints += 2;
    }
  });

  // Clasificación real de grupos calculada a partir de resultados introducidos.
  const realGroups = calculateGroupPositions_(results);
  const predGroups = prediction.groupPositions || {};
  Object.keys(realGroups).forEach(g => {
    const realTop3 = realGroups[g].slice(0,3).map(x => norm_(x.team));
    const predTop3 = (predGroups[g] || []).map(norm_);
    if (predTop3[0] && predTop3[0] === realTop3[0]) groupPoints += 5;
    if (predTop3[1] && predTop3[1] === realTop3[1]) groupPoints += 3;
    if (predTop3[2] && predTop3[2] === realTop3[2]) groupPoints += 1;
  });

  // Eliminatorias: se comparan contra listas reales guardadas en awards.knockoutReal si se añaden en el futuro.
  // En esta versión inicial el admin introduce resultados de grupos y premios.
  // Para activar puntuación de eliminatorias, añade en Premios una propiedad knockoutReal con r32, r16, qf, sf, finalists, champion, third.
  const koReal = awards.knockoutReal || {};
  const koPred = prediction.knockout || {};
  const koRules = [
    ["r32", 3], ["r16", 5], ["qf", 7], ["sf", 10], ["finalists", 18], ["champion", 25], ["third", 12]
  ];
  koRules.forEach(([stage, pts]) => {
    const realSet = new Set((koReal[stage] || []).map(norm_));
    (koPred[stage] || []).map(norm_).forEach(team => {
      if (team && realSet.has(team)) koPoints += pts;
    });
  });

  const predAwards = prediction.awards || {};
  awardPoints += podiumScore_(predAwards.goldenBoot || [], awards.goldenBoot || [], [10,6,3]);
  awardPoints += podiumScore_(predAwards.goldenBall || [], awards.goldenBall || [], [10,6,3]);
  awardPoints += podiumScore_(predAwards.goldenGlove || [], awards.goldenGlove || [], [8,5,2]);
  awardPoints += podiumScore_(predAwards.bestYoung || [], awards.bestYoung || [], [8,5,2]);
  const realXI = new Set((awards.bestXI || []).map(norm_));
  const used = new Set();
  (predAwards.bestXI || []).map(norm_).forEach(player => {
    if (player && realXI.has(player) && !used.has(player)) {
      awardPoints += 3;
      used.add(player);
    }
  });

  return { total: groupPoints + koPoints + awardPoints, groupPoints, koPoints, awardPoints };
}

function podiumScore_(pred, real, points) {
  let total = 0;
  for (let i=0; i<3; i++) {
    if (norm_(pred[i]) && norm_(pred[i]) === norm_(real[i])) total += points[i];
  }
  return total;
}

const GROUPS = {
  A:["Mexico","South Africa","Korea Republic","Czechia"],
  B:["Canada","Switzerland","Qatar","Bosnia and Herzegovina"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["United States","Paraguay","Australia","Türkiye"],
  E:["Germany","Curaçao","Côte d’Ivoire","Ecuador"],
  F:["Netherlands","Japan","Tunisia","Sweden"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cabo Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Norway","Iraq"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","Uzbekistan","Colombia","Congo DR"],
  L:["England","Croatia","Ghana","Panama"]
};

const MATCHES = [
[1,"A","Mexico","South Africa"],[2,"A","Korea Republic","Czechia"],[3,"B","Canada","Bosnia and Herzegovina"],[4,"D","United States","Paraguay"],
[5,"C","Haiti","Scotland"],[6,"D","Australia","Türkiye"],[7,"C","Brazil","Morocco"],[8,"B","Qatar","Switzerland"],
[9,"E","Côte d’Ivoire","Ecuador"],[10,"E","Germany","Curaçao"],[11,"F","Netherlands","Japan"],[12,"F","Sweden","Tunisia"],
[13,"H","Saudi Arabia","Uruguay"],[14,"H","Spain","Cabo Verde"],[15,"G","Iran","New Zealand"],[16,"G","Belgium","Egypt"],
[17,"I","France","Senegal"],[18,"I","Iraq","Norway"],[19,"J","Argentina","Algeria"],[20,"J","Austria","Jordan"],
[21,"L","Ghana","Panama"],[22,"L","England","Croatia"],[23,"K","Portugal","Congo DR"],[24,"K","Uzbekistan","Colombia"],
[25,"A","Czechia","South Africa"],[26,"B","Switzerland","Bosnia and Herzegovina"],[27,"B","Canada","Qatar"],[28,"A","Mexico","Korea Republic"],
[29,"C","Brazil","Haiti"],[30,"C","Scotland","Morocco"],[31,"D","Türkiye","Paraguay"],[32,"D","United States","Australia"],
[33,"E","Germany","Côte d’Ivoire"],[34,"E","Ecuador","Curaçao"],[35,"F","Netherlands","Sweden"],[36,"F","Tunisia","Japan"],
[37,"H","Uruguay","Cabo Verde"],[38,"H","Spain","Saudi Arabia"],[39,"G","Belgium","Iran"],[40,"G","New Zealand","Egypt"],
[41,"I","Norway","Senegal"],[42,"I","France","Iraq"],[43,"J","Argentina","Austria"],[44,"J","Jordan","Algeria"],
[45,"L","England","Ghana"],[46,"L","Panama","Croatia"],[47,"K","Portugal","Uzbekistan"],[48,"K","Colombia","Congo DR"],
[49,"C","Scotland","Brazil"],[50,"C","Morocco","Haiti"],[51,"B","Switzerland","Canada"],[52,"B","Bosnia and Herzegovina","Qatar"],
[53,"A","Czechia","Mexico"],[54,"A","South Africa","Korea Republic"],[55,"E","Curaçao","Côte d’Ivoire"],[56,"E","Ecuador","Germany"],
[57,"F","Japan","Sweden"],[58,"F","Tunisia","Netherlands"],[59,"D","Türkiye","United States"],[60,"D","Paraguay","Australia"],
[61,"I","Norway","France"],[62,"I","Senegal","Iraq"],[63,"G","Egypt","Iran"],[64,"G","New Zealand","Belgium"],
[65,"H","Cabo Verde","Saudi Arabia"],[66,"H","Uruguay","Spain"],[67,"L","Panama","England"],[68,"L","Croatia","Ghana"],
[69,"J","Algeria","Austria"],[70,"J","Jordan","Argentina"],[71,"K","Colombia","Portugal"],[72,"K","Congo DR","Uzbekistan"]
];


/* Función duplicada eliminada en v14: calculateGroupPositions_ */


function findUser_(name) {
  const rows = getRows_(SHEETS.users);
  const key = keyName_(name);
  return rows.find(r => r.nameKey === key);
}

function requireUserPin_(name, pin) {
  const user = findUser_(name);
  if (!user) throw new Error("Ese usuario no existe.");
  if (String(user.pinReset).toLowerCase() === "true") throw new Error("El PIN está reseteado. Entra de nuevo para crear uno nuevo.");
  if (user.pinHash !== hash_(String(pin || ""))) throw new Error("PIN incorrecto.");
}

function getPrediction_(name) {
  const rows = getRows_(SHEETS.predictions);
  const r = rows.find(x => x.nameKey === keyName_(name));
  return r ? JSON.parse(r.predictionJson || "{}") : null;
}

function upsertPrediction_(name, prediction) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.predictions);
  const key = keyName_(name);
  const values = sh.getDataRange().getValues();
  const json = JSON.stringify(prediction);
  for (let i=1; i<values.length; i++) {
    if (values[i][0] === key) {
      const oldJson = values[i][2] || "";
      sh.getRange(i+1, 2, 1, 4).setValues([[name, json, values[i][3] || now_(), now_()]]);
      appendHistory_(name, "predicción editada", summarizePredictionChange_(oldJson, json), oldJson, json);
      return;
    }
  }
  sh.appendRow([key, name, json, now_(), now_()]);
  appendHistory_(name, "predicción creada", "Primera predicción guardada", "", json);
}

function listPredictions_() {
  return getRows_(SHEETS.predictions).map(r => ({
    name: r.name,
    prediction: JSON.parse(r.predictionJson || "{}"),
    updatedAt: r.updatedAt
  }));
}


function listParticipants_() {
  const users = getRows_(SHEETS.users);
  const participants = getRows_(SHEETS.participants);
  const predKeys = new Set(getRows_(SHEETS.predictions).map(r => r.nameKey));
  const byKey = {};
  participants.forEach(p => byKey[p.nameKey] = p);
  return users.map(u => {
    const p = byKey[u.nameKey] || {};
    return { nameKey:u.nameKey, name:u.name, paid:String(p.paid || u.paid || "").toLowerCase()==="true", avatar:p.avatar || u.avatar || "🐀", hasPrediction: predKeys.has(u.nameKey) };
  });
}
function upsertParticipant_(name, fields) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.participants);
  const key = keyName_(name);
  const values = sh.getDataRange().getValues();
  for (let i=1;i<values.length;i++) {
    if (values[i][0] === key) {
      sh.getRange(i+1,1,1,5).setValues([[key, name, fields.paid || values[i][2] || "", fields.avatar || values[i][3] || "🐀", now_()]]);
      return;
    }
  }
  sh.appendRow([key, name, fields.paid || "", fields.avatar || "🐀", now_()]);
}
function adminSaveParticipants_(body) {
  requireAdmin_(body.adminKey);
  (body.participants || []).forEach(p => {
    if (p.name) upsertParticipant_(p.name, { paid: p.paid ? "true" : "", avatar: p.avatar || "🐀" });
  });
  log_("admin:participants", "ADMIN", "Participantes/pagos guardados");
  return { saved:true, participants:listParticipants_() };
}
function adminSavePot_(body) {
  requireAdmin_(body.adminKey);
  setJsonCell_(SHEETS.pot, "pot", body.pot || {});
  log_("admin:pot", "ADMIN", "Bote guardado");
  return { saved:true };
}

function listHistory_() {
  return getRows_(SHEETS.history).map(r => ({
    updatedAt: r.updatedAt,
    nameKey: r.nameKey,
    name: r.name,
    action: r.action,
    detail: r.detail
  }));
}

function appendHistory_(name, action, detail, oldJson, newJson) {
  appendRow_(SHEETS.history, [now_(), keyName_(name), name || "", action || "", detail || "", oldJson || "", newJson || ""]);
}

function summarizePredictionChange_(oldJson, newJson) {
  if (!oldJson) return "Primera predicción guardada";
  try {
    const oldP = JSON.parse(oldJson || "{}");
    const newP = JSON.parse(newJson || "{}");
    const oldTime = oldP.updatedAt || "sin fecha";
    const newTime = newP.updatedAt || "sin fecha";
    return "Actualización de porra. Anterior: " + oldTime + " · Nueva: " + newTime;
  } catch(e) {
    return "Actualización de porra";
  }
}

function listRanking_() {
  return getRows_(SHEETS.ranking).map(r => ({
    name: r.name,
    total: Number(r.total || 0),
    groupPoints: Number(r.groupPoints || 0),
    koPoints: Number(r.koPoints || 0),
    awardPoints: Number(r.awardPoints || 0),
    updatedAt: r.updatedAt
  }));
}

function getJsonCell_(sheetName, key, fallback) {
  const rows = getRows_(sheetName);
  const r = rows.find(x => x.key === key);
  return r ? JSON.parse(r.json || "{}") : fallback;
}

function setJsonCell_(sheetName, key, obj) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  const json = JSON.stringify(obj || {});
  for (let i=1; i<values.length; i++) {
    if (values[i][0] === key) {
      sh.getRange(i+1, 2, 1, 2).setValues([[json, now_()]]);
      return;
    }
  }
  sh.appendRow([key, json, now_()]);
}

function updateUser_(name, fields) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.users);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const key = keyName_(name);
  for (let i=1; i<values.length; i++) {
    if (values[i][0] === key) {
      Object.keys(fields).forEach(k => {
        const idx = headers.indexOf(k);
        if (idx >= 0) sh.getRange(i+1, idx+1).setValue(fields[k]);
      });
      return;
    }
  }
}

function getRows_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row.some(v => v !== "")).map(row => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = row[i]);
    return obj;
  });
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(headers); return; }
  const existing = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0];
  headers.forEach(h => {
    if (existing.indexOf(h) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
    }
  });
}

function appendRow_(sheetName, row) {
  SpreadsheetApp.getActive().getSheetByName(sheetName).appendRow(row);
}

function requireAdmin_(key) {
  if (!getAdminPin_() || String(key || "") !== getAdminPin_()) throw new Error("Clave admin incorrecta.");
}

function sign_(a,b) {
  a = Number(a); b = Number(b);
  return a > b ? "H" : a < b ? "A" : "D";
}

function cleanName_(s) {
  return String(s || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function keyName_(s) {
  return norm_(s);
}

function norm_(s) {
  return String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function hash_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function now_() {
  return new Date().toISOString();
}

function log_(action, name, detail) {
  appendRow_(SHEETS.logs, [now_(), action, name || "", detail || ""]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* v14: criterios de desempate FIFA disponibles en la hoja: puntos, diferencia, goles, enfrentamiento directo, sorteo por orden original */
function calculateGroupPositions_(results) {
  const table = {};
  Object.keys(GROUPS).forEach(g => { table[g] = {}; GROUPS[g].forEach(t => table[g][t] = { team:t, group:g, pts:0, gf:0, ga:0, gd:0 }); });
  MATCHES.forEach(([id,g,home,away]) => {
    const r = results[id]; if (!r || r.home === "" || r.away === "" || r.home === null || r.away === null) return;
    const hg=Number(r.home), ag=Number(r.away);
    table[g][home].gf += hg; table[g][home].ga += ag; table[g][away].gf += ag; table[g][away].ga += hg;
    table[g][home].gd = table[g][home].gf - table[g][home].ga; table[g][away].gd = table[g][away].gf - table[g][away].ga;
    if (hg > ag) table[g][home].pts += 3; else if (ag > hg) table[g][away].pts += 3; else { table[g][home].pts += 1; table[g][away].pts += 1; }
  });
  const out = {};
  Object.keys(table).forEach(g => { out[g] = Object.values(table[g]).sort((a,b) => compareTeamsFifa_(a,b,results)); });
  return out;
}
function compareTeamsFifa_(a,b,results){
  const base = (b.pts-a.pts) || (b.gd-a.gd) || (b.gf-a.gf);
  if (base !== 0) return base;
  const h = headToHeadCompare_(a,b,results);
  if (h !== 0) return h;
  return teamOrder_(a.team) - teamOrder_(b.team) || a.team.localeCompare(b.team);
}
function headToHeadCompare_(a,b,results){
  const g = a.group || b.group; let A={pts:0,gf:0,ga:0}, B={pts:0,gf:0,ga:0};
  MATCHES.filter(m => m[1]===g && [m[2],m[3]].indexOf(a.team)>=0 && [m[2],m[3]].indexOf(b.team)>=0).forEach(([id,grp,home,away]) => {
    const r=results[id]; if(!r) return; const hg=Number(r.home), ag=Number(r.away), aHome=home===a.team;
    const agf=aHome?hg:ag, bgf=aHome?ag:hg; A.gf+=agf; A.ga+=bgf; B.gf+=bgf; B.ga+=agf;
    if(agf>bgf) A.pts+=3; else if(agf<bgf) B.pts+=3; else {A.pts++;B.pts++;}
  });
  return (B.pts-A.pts) || ((B.gf-B.ga)-(A.gf-A.ga)) || (B.gf-A.gf);
}
function teamOrder_(team){
  const keys=Object.keys(GROUPS); for(let g of keys){ const idx=GROUPS[g].indexOf(team); if(idx>=0) return idx; } return 99;
}
