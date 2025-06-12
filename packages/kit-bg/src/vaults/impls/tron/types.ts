import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';

export type ICreateResourceRentalOrderParams = {
  fromAddress: string; // Address initiating the operation
  pledgeAddress: string; // Energy receiving address

  pledgeDay?: number; // Rental days, integer range [1-30]
  pledgeHour?: number; // Rental hours, integer range [1, 3]
  pledgeMinute?: number; // Rental minutes, integer range [10]
  pledgeNum?: number; // Amount of energy to rent
  extraTrxNum?: number; // Amount of TRX to exchange, range [0-30]; if >=0 or empty string, payment is in USDT; if not provided, payment is in TRX
  pledgeBandwidthNum?: number; // Amount of bandwidth to rent
};

export type ICreateResourceRentalOrderResponse = {
  orderId: string;
  fromAddress: string; // 发起操作地址
  pledgeAddress: string; // 接收能量地址
  pledgeDay: number; // 租赁天数 pledgeDay,pledgeHour,pledgeMinute 仅会有一个有值，按顺序优先选择第一个有值的使用
  pledgeHour: number; // 租赁小时数 pledgeDay,pledgeHour,pledgeMinute 仅会有一个有值，按顺序优先选择第一个有值的使用
  pledgeMinute: number; // 租赁分钟数 pledgeDay,pledgeHour,pledgeMinute 仅会有一个有值，按顺序优先选择第一个有值的使用
  source: string; // 第三方来源
  orderType: string; // 资源类型，目前只有ENERGY
  orderPrice: number; // 单价 SUN
  pledgeNum: number; // 租赁数量
  pledgeTrxNum: number; // 支付所需的 TRX 含低能量租赁手续费 和 激活账号费用
  payCoinCode: string; // 支付所需币种
  payCoinAmt: number; // 支付币种数量 单位与 payCoinCode 一致
  extraTrxNum: number; // 需要兑换的trx数量, 传大于等于0或空字符串认为是USDT支付 取值范围[0-30]; 不传则为TRX支付
  activeAccountFee: number; // 激活账号费用 单位与 payCoinCode 一致
  lowEnergyFee: number; // 低能量手续费 单位与 payCoinCode 一致
  purchaseTRXFee: number; // 购买trx费用 单位与 payCoinCode 一致
  purchaseEnergyFee: number; // 购买能量费用 含手续费 单位与 payCoinCode 一致
  purchaseBandwidthFee: number; // 购买带宽费用 单位与 payCoinCode 一致
  pledgeBandwidthNum: number; // 租赁带宽数量
  ratio: string; // TRX 对当前支付币种汇率
  usdtModeAvailable: boolean; // USDT 兑换是否可用
  transaction: IEncodedTxTron; // 未签名交易
};
