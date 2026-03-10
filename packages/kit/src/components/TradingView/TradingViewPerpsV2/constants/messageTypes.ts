export const MESSAGE_TYPES = {
  // Existing marks messages
  MARKS_UPDATE: 'MARKS_UPDATE',
  MARKS_RESPONSE: 'MARKS_RESPONSE',

  // Chart lines messages (App -> Iframe)
  PERPS_TV_LINES_SYNC: 'PERPS_TV_LINES_SYNC',
  PERPS_TV_LINES_PATCH: 'PERPS_TV_LINES_PATCH',
  PERPS_TV_LINES_CLEAR: 'PERPS_TV_LINES_CLEAR',
  PERPS_TV_LINE_EDIT_RESULT: 'PERPS_TV_LINE_EDIT_RESULT',
} as const;

// Iframe -> App message methods
export const PERPS_TV_MESSAGE_METHODS = {
  READY: 'tradingview_perpsReady',
  LINE_DRAG_COMMIT: 'tradingview_lineDragCommit',
  ORDER_CANCEL: 'tradingview_perpsOrderCancel',
} as const;

export type IMessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
