/**
 * Models.gs
 * データアクセス層 (DAO)
 */

function formatDate_(d) {
  if (!d) return '';
  const date = new Date(d);
  const w = ['日','月','火','水','木','金','土'][date.getDay()];
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd') + '(' + w + ')';
}
function formatTime_(d) { return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm') : ''; }

function getThisWeekEvent_() {
  const data = getSheet_(SHEETS.EVENTS).getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][4] === 'open') {
      return {
        event_id: data[i][0], date: data[i][1], date_str: formatDate_(data[i][1]),
        start_time: formatTime_(data[i][2]), end_time: formatTime_(data[i][3]), capacity_total: data[i][5]
      };
    }
  }
  return null;
}

function getFutureEvents_() {
  const data = getSheet_(SHEETS.EVENTS).getDataRange().getValues();
  const now = new Date();
  const list = [];
  for(let i=1; i<data.length; i++) {
    if (new Date(data[i][1]) >= now && data[i][4] !== 'open' && data[i][4] !== 'closed') {
      list.push({ event_id: data[i][0], date_str: formatDate_(data[i][1]), start_time: formatTime_(data[i][2]), end_time: formatTime_(data[i][3]), status: data[i][4] });
    }
  }
  return list;
}

function getAllFutureEventDates_() {
  const data = getSheet_(SHEETS.EVENTS).getDataRange().getValues();
  const now = new Date();
  now.setHours(0,0,0,0);
  const dates = [];
  for(let i=1; i<data.length; i++) {
    const d = new Date(data[i][1]);
    if (d >= now && data[i][4] !== 'canceled') {
      dates.push(Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    }
  }
  return dates;
}

function getPastEvents_(limit=30) {
  const data = getSheet_(SHEETS.EVENTS).getDataRange().getValues();
  const now = new Date();
  const list = [];
  for(let i=data.length-1; i>=1; i--) {
    const row = data[i];
    if (new Date(row[1]) < now || row[4] === 'closed') {
      list.push({ event_id: row[0], date_str: formatDate_(row[1]), status: row[4] });
      if(list.length >= limit) break;
    }
  }
  return list;
}

function getPastEventDetail_(eventId) {
  const rData = getSheet_(SHEETS.REGISTRATIONS).getDataRange().getValues();
  const mData = getSheet_(SHEETS.MEMBERS).getDataRange().getValues();
  const members = {};
  mData.slice(1).forEach(r => members[r[0]] = r[2]);
  
  const list = [];
  rData.slice(1).forEach(r => {
    if(r[0] === eventId && r[2] === 'reserved') {
      const name = members[r[1]] || '不明';
      const guests = r[3] > 0 ? ` (+${r[3]})` : '';
      list.push({ name: name, guests: guests });
    }
  });
  return list;
}

function generateDebugData_() {
  const eSheet = getSheet_(SHEETS.EVENTS);
  const mSheet = getSheet_(SHEETS.MEMBERS);
  const rSheet = getSheet_(SHEETS.REGISTRATIONS);
  const sSheet = getSheet_(SHEETS.SESSION_PARTICIPANTS);
  const now = new Date();

  const eData = eSheet.getDataRange().getValues();
  for(let i=1; i<eData.length; i++) {
    if(eData[i][4] === 'open') eSheet.getRange(i+1, 5).setValue('closed');
  }
  
  const eid = 'DEBUG-' + generateId_('E');
  eSheet.appendRow([eid, now, '18:30', '21:00', 'open', 16, now]);
  
  for(let i=1; i<=10; i++) {
    const mid = `DUMMY-M${i}`;
    mSheet.appendRow([mid, `dummy_${i}`, `テスト選手${i}`, i%2==0?'adult':'student', 'member', '', 0, now, now]);
    rSheet.appendRow([eid, mid, 'reserved', 0, '[]', 0, now, now, 'unpaid', 'day_cash']);
    sSheet.appendRow([eid, `${eid}-${mid}`, mid, `テスト選手${i}`, true, 0, 0, 'participating', 'unpaid', 'day_cash', now]);
  }
  return eid;
}

function updateEventStatus_(eventId, newStatus) {
  const sheet = getSheet_(SHEETS.EVENTS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === eventId) { sheet.getRange(i+1, 5).setValue(newStatus); return true; }
  }
  return false;
}

function getRankingData_() {
  const rData = getSheet_(SHEETS.REGISTRATIONS).getDataRange().getValues();
  const eData = getSheet_(SHEETS.EVENTS).getDataRange().getValues();
  const mData = getSheet_(SHEETS.MEMBERS).getDataRange().getValues();
  const eventDates = {}; eData.slice(1).forEach(r => eventDates[r[0]] = new Date(r[1]));
  const members = {}; mData.slice(1).forEach(r => members[r[0]] = r[2]);
  const now = new Date();
  const ranking = {}; 
  rData.slice(1).forEach(row => {
    if(row[2] !== 'reserved' && row[2] !== 'participating') return;
    const eid = row[0]; const mid = row[1]; const date = eventDates[eid];
    if(!date) return;
    if(!ranking[mid]) ranking[mid] = { name: members[mid] || '不明', month: 0, year: 0 };
    if(date.getFullYear() === now.getFullYear()) ranking[mid].year++;
    if(date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) ranking[mid].month++;
  });
  const arr = Object.values(ranking);
  const monthRank = [...arr].sort((a,b) => b.month - a.month).slice(0, 10);
  const yearRank = [...arr].sort((a,b) => b.year - a.year).slice(0, 10);
  return { month: monthRank, year: yearRank };
}

function getRegistration_(eid, mid) {
  const data = getSheet_(SHEETS.REGISTRATIONS).getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === eid && data[i][1] === mid) {
      return { rowIndex: i+1, status: data[i][2], guest_count: data[i][3], guest_info: data[i][4], payment_status: data[i][8], payment_method: data[i][9] };
    }
  }
  return null;
}

// ★追加: 現在の合計参加人数を取得 (確定済みゲスト含む)
function getCurrentTotalParticipants_(eventId) {
  const data = getSheet_(SHEETS.REGISTRATIONS).getDataRange().getValues();
  let total = 0;
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === eventId && data[i][2] === 'reserved') {
      total += 1; // 本人
      total += (Number(data[i][5]) || 0); // guest_count_confirmed
    }
  }
  return total;
}

function getRegistrationsForEvent_(eventId) {
  const rData = getSheet_(SHEETS.REGISTRATIONS).getDataRange().getValues();
  const mData = getSheet_(SHEETS.MEMBERS).getDataRange().getValues();
  const members = {}; mData.slice(1).forEach(r => members[r[0]] = r[2]);
  const list = [];
  rData.slice(1).forEach(r => {
    if(r[0] === eventId && r[2] === 'reserved') {
      const name = members[r[1]] || '不明';
      const guestCnt = r[3] || 0;
      list.push({ name: name, guests: guestCnt });
    }
  });
  return list;
}

function upsertRegistration_(eid, mid, status, guests, pStatus, pMethod) {
  const sheet = getSheet_(SHEETS.REGISTRATIONS);
  const reg = getRegistration_(eid, mid);
  const now = new Date();
  const gJson = JSON.stringify(guests || []);
  const gCount = guests ? guests.length : 0;
  
  const today = new Date();
  const ev = getThisWeekEvent_();
  let isEventDay = false;
  let capacity = 16;
  
  if (ev && ev.event_id === eid) {
    const evDate = new Date(ev.date);
    capacity = ev.capacity_total;
    if (today.getFullYear() === evDate.getFullYear() && 
        today.getMonth() === evDate.getMonth() && 
        today.getDate() === evDate.getDate()) {
      isEventDay = true;
    }
    if(getConfigValue_('debug_mode') === 'TRUE') isEventDay = true;
  }
  
  let confirmedGuests = 0;
  if (gCount > 0 && status === 'reserved') {
    if (isEventDay) {
      const current = getCurrentTotalParticipants_(eid);
      let mySpace = 0;
      if (reg && reg.status === 'reserved') mySpace = 1 + (reg.guest_count_confirmed || 0);
      
      const available = capacity - (current - mySpace);
      const guestSpace = Math.max(0, available - 1); 
      confirmedGuests = Math.min(gCount, guestSpace);
    } else {
      confirmedGuests = 0;
    }
  }

  if (reg) {
    sheet.getRange(reg.rowIndex, 3, 1, 4).setValues([[status, gCount, gJson, confirmedGuests]]);
    sheet.getRange(reg.rowIndex, 8).setValue(now);
    if(pStatus) sheet.getRange(reg.rowIndex, 9).setValue(pStatus);
    if(pMethod) sheet.getRange(reg.rowIndex, 10).setValue(pMethod);
  } else {
    const initPay = pStatus || 'unpaid';
    const initMeth = pMethod || '';
    sheet.appendRow([eid, mid, status, gCount, gJson, confirmedGuests, now, now, initPay, initMeth]);
  }
  syncSessionParticipants_(eid);
  return { confirmedGuests: confirmedGuests };
}

function syncSessionParticipants_(eventId) {
  const rData = getSheet_(SHEETS.REGISTRATIONS).getDataRange().getValues();
  const sSheet = getSheet_(SHEETS.SESSION_PARTICIPANTS);
  const sData = sSheet.getDataRange().getValues();
  const mData = getSheet_(SHEETS.MEMBERS).getDataRange().getValues();
  const members = {}; mData.slice(1).forEach(r => members[r[0]] = r[2]);
  const existing = {}; sData.slice(1).forEach((r, idx) => { if(r[0] === eventId) existing[r[1]] = idx + 2; });
  const now = new Date();
  
  rData.slice(1).forEach(r => {
    if(r[0] !== eventId || r[2] !== 'reserved') return;
    const mid = r[1]; const pStatus = r[8]; const pMethod = r[9];
    const pid = `${eventId}-${mid}`;
    if(!existing[pid]) {
      sSheet.appendRow([eventId, pid, mid, members[mid]||'unknown', true, 0, 0, 'participating', pStatus, pMethod, now]);
    } else {
      sSheet.getRange(existing[pid], 9, 1, 2).setValues([[pStatus, pMethod]]);
    }
    try {
      const guests = JSON.parse(r[4]);
      const confirmedCount = r[5] || 0;
      for(let i=0; i<confirmedCount; i++) {
        const g = guests[i];
        if(!g) break;
        const gid = `${eventId}-${mid}-G${i}`;
        if(!existing[gid]) {
          sSheet.appendRow([eventId, gid, mid, g.name, false, 0, 0, 'participating', 'unpaid', 'day_cash', now]);
        }
      }
    } catch(e){}
  });
}

function getSessionParticipants_(eid) {
  const sData = getSheet_(SHEETS.SESSION_PARTICIPANTS).getDataRange().getValues();
  const mData = getSheet_(SHEETS.MEMBERS).getDataRange().getValues();
  const members = {}; 
  mData.slice(1).forEach(r => members[r[0]] = {name: r[2], category: r[3]});

  const list = [];
  for(let i=1; i<sData.length; i++) {
    if(sData[i][0] === eid) {
      const row = sData[i];
      let displayName = row[3];
      let category = 'adult';
      
      if (row[4] && members[row[2]]) {
        displayName = members[row[2]].name;
        category = members[row[2]].category;
      } else if (row[11]) { // ★追加: 手動追加時の区分(12列目)があれば使う
        category = row[11];
      }

      list.push({
        participant_id: row[1], member_id: row[2], name: displayName, is_member: row[4],
        play_count: row[5], status: row[7], payment_status: row[8], 
        payment_method: row[9] || 'day_cash',
        category: category
      });
    }
  }
  return list;
}

function updateSessionStatuses_(eventId, statuses) {
  const sheet = getSheet_(SHEETS.SESSION_PARTICIPANTS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === eventId) {
      const pid = data[i][1];
      if(statuses[pid]) sheet.getRange(i+1, 8).setValue(statuses[pid]);
    }
  }
}


// ★変更: category引数を追加し、保存データ(配列の末尾)に追加
function addManualParticipant_(eventId, name, category) {
  const sheet = getSheet_(SHEETS.SESSION_PARTICIPANTS);
  const now = new Date();
  const id = eventId + '-MANUAL-' + generateId_('');
  const data = sheet.getDataRange().getValues();
  let maxPlay = 0; let maxRound = 0;
  data.slice(1).forEach(r => { if(r[0] === eventId) { if(r[5] > maxPlay) maxPlay = r[5]; if(r[6] > maxRound) maxRound = r[6]; } });
  
  // 12列目(index 11)に category を追加して保存
  sheet.appendRow([eventId, id, 'MANUAL', name, false, maxPlay, maxRound, 'participating', 'unpaid', 'day_cash', now, category]);
}

function getAllRoundsForEvent_(eventId) {
  const rData = getSheet_(SHEETS.ROUNDS).getDataRange().getValues();
  const rounds = [];
  for(let i=1; i<rData.length; i++) {
    if(rData[i][0] === eventId) {
      rounds.push({ round_no: rData[i][1], result: JSON.parse(rData[i][2]) });
    }
  }
  rounds.sort((a,b) => b.round_no - a.round_no);
  return rounds;
}

function deleteLastRound_(eventId) {
  const rSheet = getSheet_(SHEETS.ROUNDS);
  const spSheet = getSheet_(SHEETS.SESSION_PARTICIPANTS);
  const rData = rSheet.getDataRange().getValues();
  let targetRow = -1; let targetRound = 0; let resultJson = null;
  for(let i=1; i<rData.length; i++) {
    if(rData[i][0] === eventId && rData[i][1] > targetRound) {
      targetRound = rData[i][1]; targetRow = i + 1; resultJson = rData[i][2];
    }
  }
  if(targetRow === -1) return false;
  rSheet.deleteRow(targetRow);
  if(resultJson) {
    const res = JSON.parse(resultJson);
    const courts = res.courts || {};
    const playedNames = [];
    Object.values(courts).forEach(pairs => { pairs.forEach(pair => { pair.forEach(name => { if(name !== '?') playedNames.push(name); }); }); });
    const spData = spSheet.getDataRange().getValues();
    for(let i=1; i<spData.length; i++) {
      if(spData[i][0] === eventId && playedNames.includes(spData[i][3])) {
        const current = spData[i][5];
        if(current > 0) spSheet.getRange(i+1, 6).setValue(current - 1);
      }
    }
  }
  return true;
}

function getMember_(memberId) {
  const sheet = getSheet_(SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) { if(data[i][0] === memberId) return { member_id: data[i][0], line_user_id: data[i][1], display_name: data[i][2], category: data[i][3], role: data[i][4] }; }
  return null;
}
function getMemberByLineId_(lineUserId) {
  const sheet = getSheet_(SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) { if(data[i][1] === lineUserId) return { member_id: data[i][0], line_user_id: data[i][1], display_name: data[i][2], category: data[i][3], role: data[i][4] }; }
  return null;
}
function getAllMembers_() {
  const data = getSheet_(SHEETS.MEMBERS).getDataRange().getValues();
  const list = [];
  const roleScore = { 'admin': 3, 'sub_admin': 2, 'member': 1 };
  for(let i=1; i<data.length; i++) {
    list.push({ member_id: data[i][0], display_name: data[i][2], category: data[i][3], role: data[i][4] });
  }
  list.sort((a,b) => (roleScore[b.role]||0) - (roleScore[a.role]||0));
  return list;
}
function upsertMember_(lineUserId, displayName, category) {
  const sheet = getSheet_(SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  let rowIndex = -1; let memberId = null; let currentRole = 'member';
  for(let i=1; i<data.length; i++) { if(data[i][1] === lineUserId) { rowIndex = i + 1; memberId = data[i][0]; currentRole = data[i][4]; break; } }
  if (rowIndex > 0) {
    if(displayName) sheet.getRange(rowIndex, 3).setValue(displayName);
    if(category) sheet.getRange(rowIndex, 4).setValue(category);
    sheet.getRange(rowIndex, 9).setValue(now);
  } else {
    memberId = generateId_('M');
    sheet.appendRow([memberId, lineUserId, displayName, category || 'adult', 'member', '', 0, now, now]);
  }
  return { member_id: memberId, line_user_id: lineUserId, display_name: displayName, category: category || 'adult', role: currentRole };
}
function updateMemberRole_(memberId, role) {
  const sheet = getSheet_(SHEETS.MEMBERS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === memberId) { sheet.getRange(i+1, 5).setValue(role); break; }
  }
}

function getAccountingSummary_() {
  const data = getSheet_(SHEETS.ACCOUNTING).getDataRange().getValues();
  let total = 0, cash = 0, paypay = 0, bank = 0;
  for(let i=1; i<data.length; i++) {
    const type = data[i][2];
    const amt = Number(data[i][4]);
    const wallet = data[i][5];
    let sign = 0;
    if(type === 'income') sign = 1;
    else if(type === 'expense') sign = -1;
    
    const val = amt * sign;
    total += val;
    if(wallet === 'cash') cash += val;
    else if(wallet === 'paypay') paypay += val;
    else if(wallet === 'bank') bank += val;
  }
  return { total, cash, paypay, bank };
}

function getAccountingRecords_(limit=200) {
  const data = getSheet_(SHEETS.ACCOUNTING).getDataRange().getValues();
  const list = [];
  for(let i=data.length-1; i>=1; i--) {
    list.push({ 
      date: formatDate_(data[i][1]), 
      raw_date: data[i][1],
      type: data[i][2], 
      amount: data[i][4], 
      wallet: data[i][5], 
      desc: data[i][6] 
    });
    if(list.length >= limit) break;
  }
  return list;
}

function upsertAccounting_(type, amount, wallet, desc) {
  const sheet = getSheet_(SHEETS.ACCOUNTING);
  const now = new Date();
  sheet.appendRow([generateId_('A'), now, type, 'manual', amount, wallet, desc, '', now]);
}

function saveTransfer_(amount, fromW, toW) {
  const sheet = getSheet_(SHEETS.ACCOUNTING);
  const now = new Date();
  sheet.appendRow([generateId_('A'), now, 'expense', 'transfer', amount, fromW, `資金移動(${toW}へ)`, '', now]);
  sheet.appendRow([generateId_('A'), now, 'income', 'transfer', amount, toW, `資金移動(${fromW}より)`, '', now]);
}

function registerSchedule_(dates) {
  const sheet = getSheet_(SHEETS.EVENTS);
  const data = sheet.getDataRange().getValues();
  const existingMap = {};
  const now = new Date();
  const cap = Number(getConfigValue_('default_capacity')) || 16;
  
  for(let i=1; i<data.length; i++) {
    const row = data[i];
    if(row[4] === 'scheduled' || row[4] === 'open') {
      const dStr = Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      existingMap[dStr] = i + 1; 
    }
  }

  dates.forEach(dStr => {
    if(!existingMap[dStr]) {
      sheet.appendRow(['E'+generateId_(''), new Date(dStr), '18:30', '21:00', 'scheduled', cap, now]); 
    } else {
      delete existingMap[dStr];
    }
  });

  const rowsToDelete = Object.values(existingMap).sort((a,b) => b-a);
  rowsToDelete.forEach(rowIdx => {
    sheet.deleteRow(rowIdx);
  });
}

function cancelEvent_(eventId) {
  return updateEventStatus_(eventId, 'canceled');
}

// 参加登録時に全登録者分の参加費を見込み計上する（支払い状況によらず全 reserved を対象）
function updateAccountingAggregate_(eventId) {
  const rData = getSheet_(SHEETS.REGISTRATIONS).getDataRange().getValues();
  const mData = getSheet_(SHEETS.MEMBERS).getDataRange().getValues();
  const accSheet = getSheet_(SHEETS.ACCOUNTING);
  const fees = { adult: Number(getConfigValue_('fee_adult'))||800, college: Number(getConfigValue_('fee_college'))||600, student: Number(getConfigValue_('fee_student'))||500 };
  const memCats = {};
  mData.slice(1).forEach(r => memCats[r[0]] = r[3]);

  let total = 0;
  rData.slice(1).forEach(r => {
    if (r[0] !== eventId || r[2] !== 'reserved') return;
    const cat = memCats[r[1]] || 'adult';
    total += fees[cat] || 800;
    // 確定ゲスト分も加算
    const confirmedGuests = Number(r[5]) || 0;
    total += confirmedGuests * (fees['adult'] || 800);
  });

  const accData = accSheet.getDataRange().getValues();
  const now = new Date();
  let rowIdx = -1;
  for (let i = 1; i < accData.length; i++) {
    if (accData[i][7] === eventId && accData[i][2] === 'income' && accData[i][3] === 'fee') { rowIdx = i + 1; break; }
  }
  if (rowIdx > 0) {
    accSheet.getRange(rowIdx, 5).setValue(total);
    accSheet.getRange(rowIdx, 9).setValue(now);
  } else if (total > 0) {
    accSheet.appendRow([generateId_('A'), now, 'income', 'fee', total, 'cash', '練習参加費（見込）', eventId, now]);
  }
}

function tryConfirmGuestImmediate_(eventId) {
  const event = getThisWeekEvent_();
  if (event && event.event_id === eventId) confirmGuestsForEvent_(eventId, event.capacity_total);
}

function confirmGuestsForEvent_(eventId, capacity) {
  const rSheet = getSheet_(SHEETS.REGISTRATIONS);
  const data = rSheet.getDataRange().getValues();
  let currentTotal = 0; 
  const confirmedList = [];
  
  // まず現在の確定者数をカウント
  for(let i=1; i<data.length; i++) {
    const row = data[i];
    if(row[0] === eventId && row[2] === 'reserved') {
      currentTotal += 1; // 本人
      currentTotal += (row[5] || 0); // guest_count_confirmed
    }
  }
  
  // 未確定ゲストを順番に処理
  for(let i=1; i<data.length; i++) {
    const row = data[i];
    if(row[0] === eventId && row[2] === 'reserved') {
      const requested = row[3];
      const confirmed = row[5] || 0;
      
      if (requested > confirmed) {
        const diff = requested - confirmed;
        const available = capacity - currentTotal;
        
        if (available > 0) {
          const toAdd = Math.min(diff, available);
          rSheet.getRange(i+1, 6).setValue(confirmed + toAdd); // 更新
          currentTotal += toAdd;
          
          try {
            const guests = JSON.parse(row[4]);
            const mName = getMember_(row[1]).display_name;
            // 新たに確定したゲスト情報をリストに追加
            for(let k=confirmed; k<confirmed+toAdd; k++) {
              if (guests[k]) {
                confirmedList.push({
                   guestName: guests[k].name,
                   hostName: mName
                });
              }
            }
          } catch(e) {}
        }
      }
    }
  }
  
  // 確定したらSessionParticipantsにも同期
  syncSessionParticipants_(eventId);
  
  return { confirmedList: confirmedList };
}
