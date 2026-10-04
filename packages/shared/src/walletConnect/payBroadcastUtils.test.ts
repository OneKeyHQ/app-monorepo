import {
  hasWcPayBroadcastAction,
  shouldRefuseWcPayOptionUpfront,
  shouldRefuseWcPayWithoutDurableProgress,
} from './payBroadcastUtils';
import { EWcPayActionMethod, type IWcPayAction } from './payTypes';

// yarn jest packages/shared/src/walletConnect/payBroadcastUtils.test.ts

function action(method: EWcPayActionMethod): IWcPayAction {
  return {
    walletRpc: {
      chainId: 'eip155:8453',
      method,
      params: '[]',
    },
  };
}

const sendTx = action(EWcPayActionMethod.EthSendTransaction);
const typedData = action(EWcPayActionMethod.EthSignTypedDataV4);
const personalSign = action(EWcPayActionMethod.PersonalSign);
const solanaSign = action(EWcPayActionMethod.SolanaSignTransaction);

describe('hasWcPayBroadcastAction', () => {
  it('is true only for eth_sendTransaction', () => {
    expect(hasWcPayBroadcastAction([sendTx])).toBe(true);
    expect(hasWcPayBroadcastAction([typedData, sendTx])).toBe(true);
    expect(hasWcPayBroadcastAction([typedData])).toBe(false);
    expect(hasWcPayBroadcastAction([personalSign])).toBe(false);
    expect(hasWcPayBroadcastAction([solanaSign])).toBe(false);
  });

  it('treats missing or empty lists as non-broadcast', () => {
    expect(hasWcPayBroadcastAction(undefined)).toBe(false);
    expect(hasWcPayBroadcastAction([])).toBe(false);
  });
});

describe('shouldRefuseWcPayWithoutDurableProgress', () => {
  it('refuses broadcast actions when durable progress is unavailable', () => {
    expect(
      shouldRefuseWcPayWithoutDurableProgress({
        actions: [sendTx],
        supportsDurableProgress: false,
      }),
    ).toBe(true);
  });

  it('allows broadcast actions when durable progress is available', () => {
    expect(
      shouldRefuseWcPayWithoutDurableProgress({
        actions: [sendTx],
        supportsDurableProgress: true,
      }),
    ).toBe(false);
  });

  it('allows sign-only actions without durable progress', () => {
    expect(
      shouldRefuseWcPayWithoutDurableProgress({
        actions: [typedData, personalSign, solanaSign],
        supportsDurableProgress: false,
      }),
    ).toBe(false);
  });

  it('allows sign-only actions when durable progress is available', () => {
    expect(
      shouldRefuseWcPayWithoutDurableProgress({
        actions: [typedData],
        supportsDurableProgress: true,
      }),
    ).toBe(false);
  });
});

describe('shouldRefuseWcPayOptionUpfront', () => {
  it('refuses every option when durable progress is unavailable', () => {
    // option.actions is advisory and may be empty; the pre-form gate must
    // not consult it, or KYC could be collected before the refusal
    expect(
      shouldRefuseWcPayOptionUpfront({ supportsDurableProgress: false }),
    ).toBe(true);
  });

  it('allows options when durable progress is available', () => {
    expect(
      shouldRefuseWcPayOptionUpfront({ supportsDurableProgress: true }),
    ).toBe(false);
  });
});
