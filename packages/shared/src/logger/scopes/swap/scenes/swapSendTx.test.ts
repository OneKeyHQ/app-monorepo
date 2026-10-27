import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { ESwapEventAPIStatus } from './swapEstimateFee';
import { SwapSendTxScene } from './swapSendTx';

const base = {
  orderId: 'service-order',
  swapType: 'swap',
  slippage: '0.5',
  provider: 'provider',
  providerName: 'Provider',
  fromNetworkId: 'evm--1',
  toNetworkId: 'evm--1',
  fromTokenSymbol: 'ETH',
  toTokenSymbol: 'USDC',
  fromTokenAmount: '1',
  toTokenAmount: '2000',
  networkId: 'evm--1',
  accountId: 'private-account',
  encodedTx: 'private-transaction',
  fromAddress: 'private-sender',
  toAddress: 'private-receiver',
};

function reportSendTx(params: Parameters<SwapSendTxScene['swapSendTx']>[0]) {
  const scene = new SwapSendTxScene();
  const emit = jest
    .spyOn(scene, '_emitLog')
    .mockImplementation(() => undefined);
  scene.swapSendTx(params);
  return emit.mock.calls[0][1][0] as Record<string, unknown>;
}

describe('SwapSendTxScene', () => {
  beforeAll(() => {
    appLocale.setLocale('en-US', {
      [ETranslations.swap_page_recent_trade]: 'Recent trade',
    } as Parameters<typeof appLocale.setLocale>[1]);
  });

  it('reports the failure category and allowlisted error identifiers', () => {
    const payload = reportSendTx({
      ...base,
      status: ESwapEventAPIStatus.FAIL,
      error: {
        className: 'OneKeyHardwareError',
        code: 803,
        key: ETranslations.swap_page_recent_trade,
        message: 'Device rejected 0x1111111111111111111111111111111111111111',
      },
    });
    expect(payload).toMatchObject({
      message: 'Transaction rejected',
      errorName: 'OneKeyHardwareError',
      errorCode: '803',
      errorKey: ETranslations.swap_page_recent_trade,
    });
    expect(JSON.stringify(payload)).not.toContain('0x1111');
    expect(JSON.stringify(payload)).not.toContain('private-');
  });

  it('keeps a failure category even when the thrown value is undefined', () => {
    expect(
      reportSendTx({ ...base, status: ESwapEventAPIStatus.FAIL }),
    ).toMatchObject({ message: 'Unknown error' });
  });

  it('reports no error fields on success', () => {
    const payload = reportSendTx({
      ...base,
      status: ESwapEventAPIStatus.SUCCESS,
      error: new TypeError('ignored'),
    });
    expect(payload).not.toHaveProperty('message');
    expect(payload).not.toHaveProperty('errorName');
    expect(payload).not.toHaveProperty('errorKey');
  });
});
