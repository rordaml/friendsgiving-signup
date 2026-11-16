/**
 * Friendsgiving Signup: Google Apps Script backend.
 *
 * Paste this whole file into Extensions > Apps Script of a Google Sheet,
 * then deploy it as a web app (see README.md).
 *
 * GET  <url>            -> { ok, claims: [...] }
 * POST <url>  (JSON)    -> { action: 'add' | 'update' | 'remove', id, household, category, dish }
 *                          responds { ok, claims } or { ok: false, error }
 */

const SHEET_NAME = 'Signups';
const HEADERS = ['id', 'household', 'category', 'dish', 'ts'];
// Must match the ids in CATS in index.html.
const CATEGORIES = ['potato', 'veg', 'salad', 'starch', 'dealer', 'dessert', 'drinks', 'other'];
const MAX_HOUSEHOLD = 40;
const MAX_DISH = 60;
const MAX_ROWS = 500;

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Every non-blank row, with its sheet row number kept for edits and deletes.
function readRows_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getValues()
    .map((r, i) => ({
      row: i + 2,
      id: String(r[0]),
      household: String(r[1]),
      category: String(r[2]),
      dish: String(r[3]),
      ts: Number(r[4]) || 0
    }))
    .filter(r => r.id !== '' && r.household !== '');
}

function publicClaims_(rows) {
  return rows.map(r => ({ id: r.id, household: r.household, category: r.category, dish: r.dish, ts: r.ts }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(s, max) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
}

// Stop text like "=IMPORTXML(...)" from being treated as a formula.
function asText_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function same_(a, b) {
  return clean_(a, 200).toLowerCase() === clean_(b, 200).toLowerCase();
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function doGet() {
  return json_({ ok: true, claims: publicClaims_(readRows_(getSheet_())) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json_({ ok: false, error: 'Busy, try again' });
  }
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const sh = getSheet_();
    const rows = readRows_(sh);
    const household = clean_(body.household, MAX_HOUSEHOLD);
    const dish = clean_(body.dish, MAX_DISH);
    if (!household) return json_({ ok: false, error: 'Missing household name' });

    if (body.action === 'add') {
      if (CATEGORIES.indexOf(body.category) < 0) return json_({ ok: false, error: 'Unknown category' });
      if (rows.length >= MAX_ROWS) return json_({ ok: false, error: 'The signup list is full' });
      let id = /^[a-z0-9]{4,20}$/.test(String(body.id)) ? String(body.id) : newId_();
      if (rows.some(r => r.id === id)) id = newId_();
      sh.appendRow([id, asText_(household), body.category, asText_(dish), Date.now()]);
    } else if (body.action === 'update' || body.action === 'remove') {
      const hit = rows.find(r => r.id === String(body.id) && same_(r.household, household));
      if (!hit) return json_({ ok: false, error: 'Signup not found' });
      if (body.action === 'update') sh.getRange(hit.row, 4).setValue(asText_(dish));
      else sh.deleteRow(hit.row);
    } else {
      return json_({ ok: false, error: 'Unknown action' });
    }

    SpreadsheetApp.flush();
    return json_({ ok: true, claims: publicClaims_(readRows_(sh)) });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
