function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const definitions = {
    'Members': ['member_id', 'line_user_id', 'display_name', 'category', 'role', 'note', 'count', 'created_at', 'updated_at'],
    'Events': ['event_id', 'date', 'start_time', 'end_time', 'status', 'capacity_total', 'created_at'],
    'Registrations': ['event_id', 'member_id', 'status', 'guest_count', 'guest_info', 'guest_count_confirmed', 'created_at', 'updated_at', 'payment_status', 'payment_method'],
    'SessionParticipants': ['event_id', 'participant_id', 'member_id', 'name', 'is_member', 'play_count', 'last_round', 'status', 'payment_status', 'payment_method', 'created_at'],
    'Rounds': ['event_id', 'round_no', 'result_json', 'created_at'],
    'Payments': ['payment_id', 'event_id', 'member_id', 'amount', 'method', 'status', 'created_at'],
    'Accounting': ['record_id', 'date', 'type', 'category', 'amount', 'wallet', 'description', 'event_id', 'created_at'],
    'Config': ['key', 'value', 'note']
  };

  Object.keys(definitions).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheetName !== 'Config') {
      sheet.clear();
      sheet.appendRow(definitions[sheetName]);
    }
  });
}