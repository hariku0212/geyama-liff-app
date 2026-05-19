/**
 * Main.gs
 * エントリーポイント & トリガー & LINE Bot
 */

function doGet(e) {
  if (!e.parameter.action) {
    return HtmlService.createHtmlOutputFromFile('index').setTitle('ゲヤマクラブ').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return handleApiRequest_(e, 'GET');
}

function doPost(e) {
  if (e.parameter.action) return handleApiRequest_(e, 'POST');
  try {
    const json = JSON.parse(e.postData.contents);
    (json.events || []).forEach(ev => {
      if (ev.type === 'join') handleGroupJoin_(ev);
      if (ev.type === 'follow') handleFollow_(ev);
    });
  } catch (err) {}
  return ContentService.createTextOutput('OK');
}

function handleGroupJoin_(event) {
  const gid = event.source.groupId;
  if (!getLineGroupId_()) setConfigValue_('line_group_id', gid);
  // グループへのメッセージ送信は廃止
}

function handleFollow_(event) {
  try {
    pushLineMessage_(event.source.userId, '友だち追加ありがとうございます！🏸\n\nまずは以下のリンクから、メンバー情報の初期設定（名前・区分）をお願いします！\n\n▼ 初期設定はこちら\nhttps://liff.line.me/' + getLiffId_() + '?page=mypage');
  } catch(e) { console.error('handleFollow_ error', e); }
}

function pushLineMessage_(to, text) {
  // ★修正: ここでのデモモードブロックを削除（挨拶メッセージを通すため）
  // 個別の通知ロジック側で isDemoMode_() をチェックします。
  
  const token = getLineAccessToken_();
  if (!token || !to) return;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text }] })
    });
  } catch(e) { console.error('LINE Send Error', e); }
}

// === トリガーおじさん (毎日22-23時に実行) ===
function planDailyTriggers() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); 
  const day = tomorrow.getDay(); 

  deleteSpecificTriggers_('triggerRecruitmentStart');
  deleteSpecificTriggers_('triggerGuestConfirmation');
  deleteSpecificTriggers_('triggerCloseEvents');

  if (day === 6) { // 土曜0時
    ScriptApp.newTrigger('triggerRecruitmentStart').timeBased().at(tomorrow).create();
  }
  if (day === 0) { // 日曜0時 & 21時
    ScriptApp.newTrigger('triggerGuestConfirmation').timeBased().at(tomorrow).create();
    const closeTime = new Date(tomorrow);
    closeTime.setHours(21, 0, 0, 0);
    ScriptApp.newTrigger('triggerCloseEvents').timeBased().at(closeTime).create();
  }
}

function deleteSpecificTriggers_(functionName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === functionName) ScriptApp.deleteTrigger(trigger);
  });
}

// === 実行関数 ===
function triggerRecruitmentStart() {
  const sheet = getSheet_(SHEETS.EVENTS);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  for(let i=1; i<data.length; i++) {
    const row = data[i];
    const evDate = new Date(row[1]);
    const diff = (evDate - now) / (1000 * 60 * 60 * 24);
    if(row[4] !== 'open' && row[4] !== 'closed' && diff >= -0.1 && diff <= 2) {
      if (!isDemoMode_()) {
        sheet.getRange(i+1, 5).setValue('open');
        // グループには送らず、オーナー個人にのみ通知する
        const ownerUserId = getOwnerLineUserId_();
        if(ownerUserId) {
          const dStr = Utilities.formatDate(evDate, Session.getScriptTimeZone(), 'MM/dd');
          try {
            pushLineMessage_(ownerUserId, `🏸 参加募集スタート！\n\n📅 ${dStr} の練習参加登録フォームが開きました。\nグループへの案内をお願いします。\n\n▼ 参加登録リンク（コピーしてグループに投稿）\nhttps://liff.line.me/${getLiffId_()}?page=register`);
          } catch(e) { console.error('owner notify error', e); }
        }
      }
    }
  }
}

function triggerGuestConfirmation() {
  if (isDemoMode_()) return;
  const event = getThisWeekEvent_();
  if (!event) return;
  // ゲスト確定のみ行う。グループ通知なし。
  confirmGuestsForEvent_(event.event_id, event.capacity_total);
}

function triggerCloseEvents() {
  // デモモード中はスキップ
  if (isDemoMode_()) return;

  const sheet = getSheet_(SHEETS.EVENTS);
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][4] === 'open') sheet.getRange(i+1, 5).setValue('closed');
  }
}

/**
 * 手動でオーナーに参加募集通知を送る（緊急時用）
 * GASエディタから直接実行する。
 */
function sendManualRecruitment() {
  const dateStr = "MM/DD"; // ← 実行前に練習日付を書き換えること
  const ownerUserId = getOwnerLineUserId_();
  if (!ownerUserId) throw new Error("owner_line_user_id がConfig未設定です。");
  const message = `🏸 参加募集スタート！\n\n📅 ${dateStr} の練習参加登録フォームが開きました。\nグループへの案内をお願いします。\n\n▼ 参加登録リンク\nhttps://liff.line.me/${getLiffId_()}?page=register`;
  console.log("送信先:", ownerUserId);
  pushLineMessage_(ownerUserId, message);
  console.log("送信完了");
}
