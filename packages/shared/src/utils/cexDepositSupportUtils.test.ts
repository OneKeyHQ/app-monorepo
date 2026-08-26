import {
  getBadgeQueryTokenAddress,
  getCexDepositUnsupportedDialogCopy,
  isCexDepositExplicitlyDisabled,
  mergeCexSupportedInfo,
  pickCexDepositSupportBadge,
} from './cexDepositSupportUtils';

import type { IAddressBadge } from '../../types/address';

const stagSupportedBadges: IAddressBadge[] = [
  { label: 'Binance', type: 'default' },
  {
    tip: '您正在向一个中心化交易所地址存款。请仔细检查所选的网络和地址',
    label: 'CEX',
    type: 'default',
  },
  {
    label: '首次转账',
    tip: '首次转账到这个地址。仔细核对地址并注意风险。',
    type: 'warning',
  },
  {
    label: '支持充值',
    tip: '该交易所支持通过所选网络充值此代币。',
    type: 'default',
  },
];

describe('getBadgeQueryTokenAddress', () => {
  it('keeps an ERC-20 contract address', () => {
    expect(
      getBadgeQueryTokenAddress({
        tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      }),
    ).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7');
  });

  it('sends empty string for NFT transfers', () => {
    expect(
      getBadgeQueryTokenAddress({
        isNFT: true,
        tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      }),
    ).toBe('');
  });

  it('sends empty string for native tokens and omitted values', () => {
    expect(getBadgeQueryTokenAddress({ isNFT: false })).toBe('');
    expect(getBadgeQueryTokenAddress({ tokenAddress: undefined })).toBe('');
    expect(getBadgeQueryTokenAddress({ tokenAddress: '' })).toBe('');
  });
});

describe('isCexDepositExplicitlyDisabled', () => {
  it('alerts only when depositEnable is boolean false', () => {
    expect(isCexDepositExplicitlyDisabled(false)).toBe(true);
  });

  it('fails open for true, null, and missing values', () => {
    expect(isCexDepositExplicitlyDisabled(true)).toBe(false);
    expect(isCexDepositExplicitlyDisabled(null)).toBe(false);
    expect(isCexDepositExplicitlyDisabled(undefined)).toBe(false);
  });
});

describe('mergeCexSupportedInfo', () => {
  it('returns undefined when no response carried the field', () => {
    expect(mergeCexSupportedInfo([undefined, undefined])).toBeUndefined();
  });

  it('lets an explicit false win over true', () => {
    expect(
      mergeCexSupportedInfo([
        { depositEnable: true, cexLabel: 'Binance' },
        { depositEnable: false, cexLabel: 'Binance' },
      ]),
    ).toEqual({ depositEnable: false, cexLabel: 'Binance' });
  });

  it('lets an explicit false win over a later true', () => {
    expect(
      mergeCexSupportedInfo([
        { depositEnable: false, cexLabel: 'binance' },
        { depositEnable: true, cexLabel: 'Binance' },
      ]),
    ).toEqual({ depositEnable: false, cexLabel: 'binance' });
  });

  it('keeps true when no response is explicitly disabled', () => {
    expect(
      mergeCexSupportedInfo([{ depositEnable: true }, { depositEnable: null }]),
    ).toEqual({ depositEnable: true });
  });
});

describe('pickCexDepositSupportBadge', () => {
  it('picks the deposit badge from the stag Binance USDT payload', () => {
    expect(
      pickCexDepositSupportBadge({
        badges: stagSupportedBadges,
        cexLabel: 'Binance',
        addressLabel: 'Binance',
      }),
    ).toEqual({
      label: '支持充值',
      tip: '该交易所支持通过所选网络充值此代币。',
      type: 'default',
    });
  });

  it('skips the exchange-name badge when cexLabel casing differs', () => {
    expect(
      pickCexDepositSupportBadge({
        badges: stagSupportedBadges,
        cexLabel: 'binance',
        addressLabel: 'Binance',
      })?.label,
    ).toBe('支持充值');
  });

  it('picks the unsupported default badge instead of first-transfer', () => {
    expect(
      pickCexDepositSupportBadge({
        badges: [
          { label: 'Binance', type: 'default' },
          { label: 'CEX', type: 'default', tip: 'cex tip' },
          {
            label: '首次转账',
            type: 'warning',
            tip: 'first transfer',
          },
          {
            label: '不支持充值',
            type: 'default',
            tip: '该交易所不支持通过所选网络充值此代币。',
          },
        ],
        cexLabel: 'Binance',
        addressLabel: 'Binance',
      })?.label,
    ).toBe('不支持充值');
  });
});

describe('getCexDepositUnsupportedDialogCopy', () => {
  it('uses the deposit badge label and tip', () => {
    expect(
      getCexDepositUnsupportedDialogCopy({
        badges: [
          { label: 'CEX', type: 'default', tip: 'cex tip' },
          {
            label: '不支持充值',
            type: 'default',
            tip: '该交易所不支持通过所选网络充值此代币。',
          },
        ],
        cexLabel: 'Binance',
      }),
    ).toEqual({
      title: '不支持充值',
      description: '该交易所不支持通过所选网络充值此代币。',
    });
  });

  it('falls back to the CEX badge tip when the deposit badge is missing', () => {
    expect(
      getCexDepositUnsupportedDialogCopy({
        badges: [
          {
            label: 'CEX',
            type: 'default',
            tip: '您正在向一个中心化交易所地址存款。请仔细检查所选的网络和地址',
          },
        ],
        addressLabel: 'Binance',
      }),
    ).toEqual({
      title: 'CEX',
      description:
        '您正在向一个中心化交易所地址存款。请仔细检查所选的网络和地址',
    });
  });
});
