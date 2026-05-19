const SHEETS = {
  MEMBERS: 'Members',
  EVENTS: 'Events',
  REGISTRATIONS: 'Registrations',
  PAYMENTS: 'Payments',
  SESSION_PARTICIPANTS: 'SessionParticipants',
  ROUNDS: 'Rounds',
  ACCOUNTING: 'Accounting',
  CONFIG: 'Config',
};

function getLiffId_() {
  const id = PropertiesService.getScriptProperties().getProperty('LIFF_ID');
  if (!id) throw new Error('LIFF_ID がスクリプトプロパティに未設定です。プロジェクト設定から登録してください。');
  return id;
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function generateId_(prefix) {
  return prefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmssSSS');
}

function getConfigValue_(key) {
  const sheet = getSheet_(SHEETS.CONFIG);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return '';
}

function setConfigValue_(key, value) {
  const sheet = getSheet_(SHEETS.CONFIG);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getLineAccessToken_() { return getConfigValue_('line_channel_access_token'); }
function getLineGroupId_() { return getConfigValue_('line_group_id'); }
function getOwnerLineUserId_() { return getConfigValue_('owner_line_user_id'); }
function getPayPayConfig_() {
  return { id: getConfigValue_('paypay_user_id'), receiver: getConfigValue_('paypay_receiver_name') };
}
// デモモード判定
function isDemoMode_() {
  const val = getConfigValue_('demo_mode');
  return String(val).toUpperCase() === 'TRUE';
}