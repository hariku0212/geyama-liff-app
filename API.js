/**
 * API.gs
 * APIハンドラ
 */

function handleApiRequest_(e, method) {
  const action = e.parameter.action;
  let body = {};
  try { if (method === 'POST') body = JSON.parse(e.postData.contents); } catch(e){}
  const params = { ...e.parameter, ...body };
  let res = { ok: false };

  const isDemo = isDemoMode_();
  
  // ★修正: デモモードでも実行したいアクションはここから外しました
  // ブロックするのは「全体設定」「帳簿直接編集」「イベント中止」などのクリティカルなもの
  const blockedInDemo = [
    'save_accounting', 
    'save_transfer', 
    'save_schedule', 
    'update_role', 
    'save_fee_config', 
    'cancel_event'
  ];

  if (isDemo && blockedInDemo.includes(action)) {
    return json_({ ok: true, is_demo_mock: true });
  }

  try {
    if (action === 'get_me') {
      const m = getMemberByLineId_(params.lineUserId);
      res = { ok: true, exists: !!m, member: m, paypay_config: getPayPayConfig_(), is_demo: isDemo };
    
    } else if (action === 'upsert_member') {
      const memberObj = upsertMember_(params.lineUserId, params.display_name, params.category);
      res = { ok: true, member: memberObj };

    } else if (action === 'get_this_week') {
      const ev = getThisWeekEvent_();
      let regs = [];
      if(ev) regs = getRegistrationsForEvent_(ev.event_id);
      res = { ok: true, event: ev, registrations: regs };

    } else if (action === 'get_my_registration') {
      res = { ok: true, registration: getRegistration_(params.event_id, params.member_id) };

    } else if (action === 'register') {
      const pStat = params.is_paid ? 'paid_advance' : 'unpaid';
      const pMeth = params.is_paid ? 'advance' : params.pay_method;

      const regResult = upsertRegistration_(params.event_id, params.member_id, params.status, params.guests, pStat, pMeth);

      if (params.status === 'reserved' && !isDemo) {
        // 登録者本人へ個人チャットで確認通知
        const mem = getMember_(params.member_id);
        const ev = getThisWeekEvent_();
        if (mem && mem.line_user_id && ev) {
          try {
            const regs = getRegistrationsForEvent_(params.event_id);
            const total = regs.reduce((a,b) => a + 1 + b.guests, 0);
            const remain = Math.max(0, ev.capacity_total - total);
            pushLineMessage_(mem.line_user_id, `✅ ${ev.date_str} の練習参加登録を受け付けました！\n\n現在 ${total}名（残り${remain}名）\n\n▼ 参加者一覧\nhttps://liff.line.me/${getLiffId_()}?page=register`);
          } catch(e) { console.error('registration notify error', e); }
        }
        tryConfirmGuestImmediate_(params.event_id);
        // 参加登録時点で売上を計上する
        updateAccountingAggregate_(params.event_id);
      } else if (params.status === 'canceled' && !isDemo) {
        // キャンセル時も売上を再計算する
        updateAccountingAggregate_(params.event_id);
      }
      res = { ok: true };

    } else if (action === 'pay_advance') {
      const reg = getRegistration_(params.event_id, params.member_id);
      if(reg) upsertRegistration_(params.event_id, params.member_id, reg.status, JSON.parse(reg.guest_info), 'paid_advance', 'advance');
      res = { ok: true };

    } else if (action === 'get_participants_detail') {
      const sps = getSessionParticipants_(params.event_id);
      const rounds = getAllRoundsForEvent_(params.event_id);
      res = { ok: true, data: { participants: sps, allRounds: rounds } };

    } else if (action === 'manual_add_participant') {
      // ★修正: params.category を渡す
      addManualParticipant_(params.event_id, params.name, params.category);
      res = { ok: true };

    } else if (action === 'generate_debug') {
      // ★修正: 実行者が本当の管理者(admin)かチェック
      const realUser = getMemberByLineId_(params.lineUserId);
      if (realUser && realUser.role === 'admin') {
        res = { ok: true, event_id: generateDebugData_() };
      } else {
        res = { ok: false, error: 'Permission denied' };
      }

    }
    // ... Read Only Actions ...
    else if (action === 'get_past_event_detail') { res = { ok: true, participants: getPastEventDetail_(params.event_id) }; }
    else if (action === 'get_rankings') { res = { ok: true, data: getRankingData_() }; }
    else if (action === 'get_future_events') { res = { ok: true, events: getFutureEvents_() }; }
    else if (action === 'get_past_events') { res = { ok: true, events: getPastEvents_() }; }
    
    // ... Blocked Actions (Mocked above) ...
    else if (action === 'get_admin_init') {
      res = { ok: true, summary: getAccountingSummary_(), fees: { adult: getConfigValue_('fee_adult'), college: getConfigValue_('fee_college'), student: getConfigValue_('fee_student'), capacity: getConfigValue_('default_capacity') || 16 }, members: getAllMembers_(), registeredDates: getAllFutureEventDates_() };
    }
    else if (action === 'get_accounting_list') { res = { ok: true, list: getAccountingRecords_(100) }; }
    else if (action === 'save_accounting') { upsertAccounting_(params.type, params.amount, params.wallet, params.desc); res = { ok: true }; }
    else if (action === 'save_transfer') { saveTransfer_(params.amount, params.from_wallet, params.to_wallet); res = { ok: true }; }
    else if (action === 'save_schedule') { registerSchedule_(params.dates); res = { ok: true }; }
    else if (action === 'update_role') { updateMemberRole_(params.member_id, params.role); res = { ok: true }; }
    else if (action === 'save_fee_config') {
      if(params.adult) setConfigValue_('fee_adult', params.adult);
      if(params.college) setConfigValue_('fee_college', params.college);
      if(params.student) setConfigValue_('fee_student', params.student);
      if(params.capacity) setConfigValue_('default_capacity', params.capacity);
      res = { ok: true };
    }

  } catch(e) { res = { ok: false, error: e.toString() }; }
  return json_(res);
}
