/**
 * LINE push のレスポンス(HTTPコード/本文)を必ず返すデバッグ用
 * 既存 pushLineMessage_ には手を入れない（仕様影響ゼロ）
 */
function pushLineMessageDebug_(to, text) {
  const token = getLineAccessToken_();
  if (!token) return { ok: false, reason: 'no_token' };
  if (!to) return { ok: false, reason: 'no_to' };

  const payload = JSON.stringify({
    to: to,
    messages: [{ type: 'text', text: text }]
  });

  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    muteHttpExceptions: true, // ★これが重要：エラーでも本文を取れる
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    payload: payload
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  return {
    ok: (200 <= code && code < 300),
    status: code,
    body: body
  };
}

/**
 * ① まず「現在設定されている groupId」にテスト送信して、送信先/権限/トークンを確認する
 */
function debug_sendTestToConfiguredGroup() {
  const gid = getLineGroupId_();
  console.log('[debug] configured gid =', gid);

  const msg = `【debug】テスト送信 ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss')}`;
  const result = pushLineMessageDebug_(gid, msg);

  console.log('[debug] push result =', JSON.stringify(result));
}

/**
 * ② 「はりく」さんを指定イベントに reserved 登録し、その直後に通知送信まで "同等の計算" を行いログを出す
 * ※実データを書き換えます（参加登録を実際に行う）
 */
function debug_registerHariku_and_notify() {
  // ===== ユーザー指定の固定値 =====
  const eventId  = 'E20251211225926302';
  const memberId = 'M20251212210317105';

  // ===== ここは "確認が必要" なので暫定値にしています =====
  // アプリと同じにしたい場合、実際の送信値に合わせてください。
  const status   = 'reserved';
  const guests   = [];              // ゲストなし想定
  const is_paid  = false;           // 事前払いなし想定
  const pay_method = 'day_cash';    // 現地現金想定
  // =================================

  console.log('=== debug_registerHariku_and_notify START ===');
  console.log('[debug] demoMode =', isDemoMode_());

  // 現状確認（重要）
  const gid = getLineGroupId_();
  console.log('[debug] configured gid =', gid);

  const mem = getMember_(memberId);
  console.log('[debug] member =', JSON.stringify(mem));

  const thisWeekEv = getThisWeekEvent_();
  console.log('[debug] getThisWeekEvent_ =', JSON.stringify(thisWeekEv));

  // 既存登録の有無
  const oldReg = getRegistration_(eventId, memberId);
  console.log('[debug] oldReg =', JSON.stringify(oldReg));

  // 参加登録（実データを書き換え）
  const pStat = is_paid ? 'paid_advance' : 'unpaid';
  const pMeth = is_paid ? 'advance' : pay_method;

  const upsertRes = upsertRegistration_(eventId, memberId, status, guests, pStat, pMeth);
  console.log('[debug] upsertRegistration_ result =', JSON.stringify(upsertRes));

  // 通知文を作る（API.gs と同等）
  const regs = getRegistrationsForEvent_(eventId);
  const total = regs.reduce((a, b) => a + 1 + Number(b.guests || 0), 0);

  // ★ここが "仕様上のズレ" になり得るのでログに出す
  // API.gs は remain を getThisWeekEvent_() の capacity_total で計算している
  const cap = thisWeekEv ? Number(thisWeekEv.capacity_total) : null;
  const remain = (cap == null) ? null : Math.max(0, cap - total);

  console.log('[debug] total participants calc =', total);
  console.log('[debug] capacity(from thisWeekEv) =', cap, 'remain =', remain);

  const name = (mem && mem.display_name) ? mem.display_name : memberId;
  const msg = `【debug】${name}さんが参加します(現在${total}名/残り${remain}名)`;
  console.log('[debug] message =', msg);

  // 送信（レスポンスを必ず見る）
  const pushRes = pushLineMessageDebug_(gid, msg);
  console.log('[debug] pushLineMessageDebug_ result =', JSON.stringify(pushRes));

  console.log('=== debug_registerHariku_and_notify END ===');
}
