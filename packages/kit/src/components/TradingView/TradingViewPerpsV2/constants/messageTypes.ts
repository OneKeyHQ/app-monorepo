export const MESSAGE_TYPES = {
  // Existing marks messages
  MARKS_UPDATE: 'MARKS_UPDATE',
  MARKS_RESPONSE: 'MARKS_RESPONSE',

  // Chart lines messages (App -> Iframe)
  PERPS_TV_LINES_SYNC: 'PERPS_TV_LINES_SYNC',
  PERPS_TV_LINES_PATCH: 'PERPS_TV_LINES_PATCH',
  PERPS_TV_LINES_CLEAR: 'PERPS_TV_LINES_CLEAR',
  PERPS_TV_LINE_EDIT_RESULT: 'PERPS_TV_LINE_EDIT_RESULT',
  PERPS_TV_ORDER_PRICE_UPDATE_REJECTED: 'PERPS_TV_ORDER_PRICE_UPDATE_REJECTED',
  PERPS_TV_CHART_EXPAND_SYNC: 'PERPS_TV_CHART_EXPAND_SYNC',
} as const;

// Iframe -> App message methods
export const PERPS_TV_MESSAGE_METHODS = {
  CHART_READY: 'tradingview_chartReady',
  READY: 'tradingview_perpsReady',
  LINE_DRAG_COMMIT: 'tradingview_lineDragCommit',
  ORDER_CANCEL: 'tradingview_perpsOrderCancel',
  ORDER_DRAFT_CREATE: 'tradingview_perpsOrderDraftCreate',
  ORDER_PRICE_UPDATE: 'tradingview_perpsOrderPriceUpdate',
  CHART_EXPAND: 'tradingview_chartExpand',
} as const;

export type IMessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
