import {
  EStakingActionType,
  type IEarnToken,
  type IEarnTokenInfo,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { resolveWithdrawShareToken } from './withdrawShareTokenUtils';

const shareAddress = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const shareToken: IEarnToken = {
  uniqueKey: shareAddress,
  address: shareAddress,
  symbol: 'liquidETH',
  name: 'Liquid ETH',
  decimals: 18,
  isNative: false,
  logoURI: '',
  totalSupply: '0',
  riskLevel: 0,
  coingeckoId: '',
  networkId: 'evm--1',
};
const depositToken: IEarnToken = {
  ...shareToken,
  uniqueKey: 'eETH',
  address: '0x35fa164735182de50811e8e2e824cfb9b6118ac2',
  symbol: 'eETH',
  name: 'ether.fi ETH',
};
const account = {
  accountId: 'account-id',
  networkId: 'evm--1',
  provider: 'etherfi',
};
const tokenInfo: IEarnTokenInfo = {
  ...account,
  vault: shareAddress,
  token: depositToken,
  price: '3000',
  balanceParsed: '99',
};
const protocolInfo: IProtocolInfo = {
  ...account,
  symbol: 'eETH',
  vault: shareAddress,
  stakeTag: 'etherfi-eeth',
  providerDetail: { name: 'ether.fi', logoURI: '' },
  withdrawApprove: {
    amountUnit: 'shares',
    tokenAddress: shareAddress,
  },
  activeBalance: '1.250000000000000001',
};

/** 使用现有 DTO 的嵌套资产形状构造服务端元数据；动作类型不影响资产身份校验。 */
function withReceipt(
  receipt: IEarnToken = shareToken,
  balance = '1.000000000000000001',
): IProtocolInfo {
  return {
    ...protocolInfo,
    withdrawAction: {
      type: EStakingActionType.CancelWithdrawal,
      disabled: false,
      text: { text: 'Withdraw' },
      data: { balance, token: { info: receipt, price: '3300' } },
    },
  };
}

describe('独立赎回页份额身份', () => {
  it('使用真实份额的数量、精度和价格，并丢弃不同入口资产的预填数量', () => {
    const result = resolveWithdrawShareToken({
      ...account,
      protocolInfo: withReceipt(),
      tokenInfo,
      initialAmount: '2',
    });

    expect(result).toMatchObject({
      ready: true,
      balance: '1.000000000000000001',
      initialAmount: undefined,
      tokenInfo: {
        token: shareToken,
        price: '3300',
        balanceParsed: '1.000000000000000001',
      },
    });
    expect(tokenInfo.token).toBe(depositToken);
    expect(tokenInfo.price).toBe('3000');
  });

  it('原入口已经是份额时保留预填数量，无按钮元数据也可安全使用', () => {
    const result = resolveWithdrawShareToken({
      ...account,
      protocolInfo,
      tokenInfo: { ...tokenInfo, token: shareToken, price: '3250' },
      initialAmount: '0.500000000000000001',
    });

    expect(result).toMatchObject({
      ready: true,
      balance: protocolInfo.activeBalance,
      initialAmount: '0.500000000000000001',
      tokenInfo: { token: shareToken, price: '3250' },
    });
  });

  it.each([
    ['缺少按钮元数据', protocolInfo],
    ['按钮仍返回存入币', withReceipt(depositToken)],
    ['份额被标成原生币', withReceipt({ ...shareToken, isNative: true })],
    ['精度无效', withReceipt({ ...shareToken, decimals: -1 })],
    [
      '授权份额地址缺失',
      { ...withReceipt(), withdrawApprove: { amountUnit: 'shares' as const } },
    ],
  ])('%s 时禁用，不把 eETH 的金额或价格解释为 liquidETH', (_name, protocol) => {
    expect(
      resolveWithdrawShareToken({
        ...account,
        protocolInfo: protocol,
        tokenInfo,
        initialAmount: '2',
      }),
    ).toEqual({ ready: false, tokenInfo: undefined, initialAmount: undefined });
  });

  it('份额地址忽略大小写，零余额仍是有效仓位元数据', () => {
    const result = resolveWithdrawShareToken({
      ...account,
      protocolInfo: withReceipt(
        { ...shareToken, address: shareAddress.toUpperCase() },
        '0',
      ),
      tokenInfo,
    });

    expect(result.ready).toBe(true);
    expect(result.balance).toBe('0');
  });

  it('按钮资产不匹配时不采用它的余额或价格，匹配的原份额元数据仍可使用', () => {
    const result = resolveWithdrawShareToken({
      ...account,
      protocolInfo: withReceipt(depositToken, '999'),
      tokenInfo: { ...tokenInfo, token: shareToken, price: '3250' },
    });

    expect(result).toMatchObject({
      ready: true,
      balance: protocolInfo.activeBalance,
      tokenInfo: { token: shareToken, price: '3250' },
    });
  });

  it('未声明 shares 的协议保留原资产信息和预填数量，不推断金额单位', () => {
    const result = resolveWithdrawShareToken({
      ...account,
      protocolInfo: { ...withReceipt(), withdrawApprove: undefined },
      tokenInfo,
      initialAmount: '2',
    });

    expect(result).toEqual({ ready: true, tokenInfo, initialAmount: '2' });
    expect(result.tokenInfo).toBe(tokenInfo);
  });

  it('取消已有请求不要求份额元数据，保留原入口信息以继续取消流程', () => {
    const result = resolveWithdrawShareToken({
      ...account,
      protocolInfo,
      tokenInfo,
      initialAmount: '0',
      withdrawType: 'cancel',
    });

    expect(result).toEqual({ ready: true, tokenInfo, initialAmount: '0' });
    expect(result.tokenInfo).toBe(tokenInfo);
  });
});
