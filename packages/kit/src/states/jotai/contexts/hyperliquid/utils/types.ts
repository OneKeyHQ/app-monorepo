// Hyperliquid Types Definition

export enum EActionType {
  PLACE_ORDER = 'placeOrder',
  ORDER_OPEN = 'orderOpen',
  ORDERS_CLOSE = 'ordersClose',
  LIMIT_ORDER_CLOSE = 'limitOrderClose',
  UPDATE_LEVERAGE = 'updateLeverage',
  SET_POSITION_TPSL = 'setPositionTpsl',
  CANCEL_ORDER = 'cancelOrder',
  WITHDRAW = 'withdraw',
}

export enum EErrorType {
  INVALID_AGENT = 'InvalidAgent',
}

export interface IToastConfig {
  loading?: string | ((...args: any[]) => string);
  successTitle: string | ((...args: any[]) => string);
  successMessage?: string | ((...args: any[]) => string);
}
