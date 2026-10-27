import type {
  IWcPayAction,
  IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

import {
  checkWcPayEvmActionMatchesOrder,
  checkWcPayEvmTxMatchesOrder,
} from './wcPayOrderConsistency';

// yarn jest packages/kit-bg/src/services/ServiceWalletConnectPay/wcPayOrderConsistency.test.ts

const SENDER = '0x1111111111111111111111111111111111111111';
const TOKEN = '0x2222222222222222222222222222222222222222';
const RECIPIENT = '0x3333333333333333333333333333333333333333';

function buildOption({
  value = '1000000',
}: { value?: string } = {}): IWcPayOption {
  return {
    id: 'opt-1',
    account: `eip155:8453:${SENDER}`,
    amount: {
      unit: 'usdc',
      value,
      display: { assetSymbol: 'USDC', assetName: 'USD Coin', decimals: 6 },
    },
    etaS: 10,
    actions: [],
  };
}

function buildAction({
  chainId = 'eip155:8453',
  tx,
}: {
  chainId?: string;
  tx: Record<string, string | undefined>;
}): IWcPayAction {
  return {
    walletRpc: {
      chainId,
      method: 'eth_sendTransaction',
      params: JSON.stringify([tx]),
    },
  };
}

// transfer(RECIPIENT, 1000000)
const TRANSFER_DATA = `0xa9059cbb${RECIPIENT.slice(2).padStart(64, '0')}${(1_000_000)
  .toString(16)
  .padStart(64, '0')}`;

describe('checkWcPayEvmActionMatchesOrder', () => {
  it('accepts a matching ERC20 transfer', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: TOKEN, data: TRANSFER_DATA, value: '0x0' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'erc20',
    });
  });

  it('accepts a matching native transfer', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '0xf4240' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'native',
    });
  });

  it('accepts case-insensitive sender match', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER.toUpperCase(),
        to: TOKEN,
        data: TRANSFER_DATA,
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(true);
  });

  it('rejects an inflated ERC20 amount', () => {
    const option = buildOption();
    const inflatedData = `0xa9059cbb${RECIPIENT.slice(2).padStart(
      64,
      '0',
    )}${(2_000_000).toString(16).padStart(64, '0')}`;
    const action = buildAction({
      tx: { from: SENDER, to: TOKEN, data: inflatedData, value: '0x0' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects a chain mismatch', () => {
    const option = buildOption();
    const action = buildAction({
      chainId: 'eip155:1',
      tx: { from: SENDER, to: TOKEN, data: TRANSFER_DATA, value: '0x0' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects a sender mismatch', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: RECIPIENT, to: TOKEN, data: TRANSFER_DATA, value: '0x0' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects a non-transfer selector', () => {
    const option = buildOption();
    // approve(address,uint256), correct length, wrong selector
    const approveData = `0x095ea7b3${RECIPIENT.slice(2).padStart(
      64,
      '0',
    )}${(1_000_000).toString(16).padStart(64, '0')}`;
    const action = buildAction({
      tx: { from: SENDER, to: TOKEN, data: approveData, value: '0x0' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects transfer calldata with trailing bytes', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: `${TRANSFER_DATA}ff`,
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects an ERC20 transfer that also moves native value', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: TOKEN, data: TRANSFER_DATA, value: '0x1' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects a native transfer with wrong value', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '0xf4241' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects missing from', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { to: RECIPIENT, value: '0xf4240' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects malformed params without throwing', () => {
    const option = buildOption();
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: 'not-json',
      },
    };
    expect(() =>
      checkWcPayEvmActionMatchesOrder({ action, option }),
    ).not.toThrow();
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects a non-string data field instead of coercing it away', () => {
    const option = buildOption();
    const tx: Record<string, unknown> = {
      from: SENDER,
      to: RECIPIENT,
      data: 123,
      value: '0xf4240',
    };
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: JSON.stringify([tx]),
      },
    };
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects a non-string value field instead of coercing it away', () => {
    const option = buildOption();
    const tx: Record<string, unknown> = {
      from: SENDER,
      to: TOKEN,
      data: TRANSFER_DATA,
      value: 1,
    };
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: JSON.stringify([tx]),
      },
    };
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('accepts uppercase "0X0" calldata as empty (native transfer)', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, data: '0X0', value: '0xf4240' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'native',
    });
  });

  it('rejects an action missing walletRpc without throwing', () => {
    const option = buildOption();
    const action = {} as IWcPayAction;
    expect(() =>
      checkWcPayEvmActionMatchesOrder({ action, option }),
    ).not.toThrow();
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects an oversized hex value before it reaches BigNumber (DoS guard)', () => {
    const option = buildOption();
    // 65 hex chars — one over the 32-byte (64 hex char) cap
    const oversizedValue = `0x${'1'.repeat(65)}`;
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: oversizedValue },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects scientific-notation and plus-prefixed values', () => {
    const option = buildOption();
    const scientific = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '1e6' },
    });
    const plusPrefixed = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '+1000000' },
    });
    expect(
      checkWcPayEvmActionMatchesOrder({ action: scientific, option }).ok,
    ).toBe(false);
    expect(
      checkWcPayEvmActionMatchesOrder({ action: plusPrefixed, option }).ok,
    ).toBe(false);
  });

  it('accepts a plain decimal-string value for a native transfer', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '1000000' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'native',
    });
  });

  it('rejects a native transfer missing `to`', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, value: '0xf4240' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects personal_sign even with native-transfer-shaped params', () => {
    const option = buildOption();
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'personal_sign',
        params: JSON.stringify([
          { from: SENDER, to: RECIPIENT, value: '0xf4240' },
        ]),
      },
    };
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects an empty or malformed option without throwing', () => {
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '0xf4240' },
    });
    const emptyOption = {} as IWcPayOption;
    const nonStringAccountOption = {
      ...buildOption(),
      account: 123,
    } as unknown as IWcPayOption;
    expect(() =>
      checkWcPayEvmActionMatchesOrder({ action, option: emptyOption }),
    ).not.toThrow();
    expect(
      checkWcPayEvmActionMatchesOrder({ action, option: emptyOption }).ok,
    ).toBe(false);
    expect(
      checkWcPayEvmActionMatchesOrder({
        action,
        option: nonStringAccountOption,
      }).ok,
    ).toBe(false);
  });

  it('rejects a tx carrying a `nonce` field', () => {
    const option = buildOption();
    const tx: Record<string, unknown> = {
      from: SENDER,
      to: RECIPIENT,
      value: '0xf4240',
      nonce: '0x1',
    };
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: JSON.stringify([tx]),
      },
    };
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('accepts a native transfer carrying tolerated fee fields', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: RECIPIENT,
        value: '0xf4240',
        gasPrice: '0x1',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'native',
    });
  });

  it('rejects a tx carrying an unrecognized field (accessList)', () => {
    const option = buildOption();
    const tx: Record<string, unknown> = {
      from: SENDER,
      to: RECIPIENT,
      value: '0xf4240',
      accessList: [],
    };
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: JSON.stringify([tx]),
      },
    };
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects an option account with the wrong number of CAIP-10 segments', () => {
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '0xf4240' },
    });
    const twoSegments: IWcPayOption = {
      ...buildOption(),
      account: 'eip155:8453',
    };
    const fourSegments: IWcPayOption = {
      ...buildOption(),
      account: `eip155:8453:${SENDER}:extra`,
    };
    expect(
      checkWcPayEvmActionMatchesOrder({ action, option: twoSegments }).ok,
    ).toBe(false);
    expect(
      checkWcPayEvmActionMatchesOrder({ action, option: fourSegments }).ok,
    ).toBe(false);
  });

  it('rejects a params array with more than one element', () => {
    const option = buildOption();
    const tx = { from: SENDER, to: RECIPIENT, value: '0xf4240' };
    const action: IWcPayAction = {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: JSON.stringify([tx, tx]),
      },
    };
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects an ERC20 transfer with a non-canonical recipient word', () => {
    const option = buildOption();
    // Corrupt the first hex char of the (normally all-zero) high 12 bytes.
    const paddedRecipient = RECIPIENT.slice(2).padStart(64, '0');
    const nonCanonicalRecipientWord = `1${paddedRecipient.slice(1)}`;
    const nonCanonicalData = `0xa9059cbb${nonCanonicalRecipientWord}${(1_000_000)
      .toString(16)
      .padStart(64, '0')}`;
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: nonCanonicalData,
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('rejects an uppercase "0X" value prefix (ethers.BigNumber.from parity)', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '0XF4240' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option }).ok).toBe(false);
  });

  it('accepts a lowercase "0x" prefix with uppercase hex digits', () => {
    const option = buildOption();
    const action = buildAction({
      tx: { from: SENDER, to: RECIPIENT, value: '0xF4240' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'native',
    });
  });
});

describe('checkWcPayEvmTxMatchesOrder', () => {
  it('accepts a matching ERC20 transfer given an already-parsed tx', () => {
    const option = buildOption();
    const result = checkWcPayEvmTxMatchesOrder({
      tx: { from: SENDER, to: TOKEN, data: TRANSFER_DATA, value: '0x0' },
      caip2ChainId: 'eip155:8453',
      option,
    });
    expect(result).toEqual({ ok: true, kind: 'erc20' });
  });

  describe('final-recheck nonce stage (expectedNonce)', () => {
    // A realistic FINAL encodedTx as the evm vault produces it right before
    // signing: nonce/fee fields attached as real numbers/strings, chainId
    // rewritten to hex — none of that should ever reach this function's
    // `caip2ChainId` param (that stays the option's CAIP-2 chain).
    const FINAL_ENCODED_TX: Record<string, unknown> = {
      from: SENDER,
      to: RECIPIENT,
      value: '0xf4240',
      data: '0x',
      chainId: '0x2105',
      nonce: 42,
      gas: '0x5208',
      gasLimit: '0x5208',
      maxFeePerGas: '0x3b9aca00',
      maxPriorityFeePerGas: '0x3b9aca00',
    };

    it('accepts the final encodedTx when tx.nonce matches expectedNonce', () => {
      const result = checkWcPayEvmTxMatchesOrder({
        tx: FINAL_ENCODED_TX,
        caip2ChainId: 'eip155:8453',
        option: buildOption(),
        expectedNonce: 42,
      });
      expect(result).toEqual({ ok: true, kind: 'native' });
    });

    it('rejects the final encodedTx when tx.nonce does not match expectedNonce', () => {
      const result = checkWcPayEvmTxMatchesOrder({
        tx: FINAL_ENCODED_TX,
        caip2ChainId: 'eip155:8453',
        option: buildOption(),
        expectedNonce: 41,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects the same tx at the pre-flight stage (no expectedNonce)', () => {
      // Locks in that the pre-flight `nonce` rejection path is still intact
      // once a caller starts passing expectedNonce elsewhere.
      const result = checkWcPayEvmTxMatchesOrder({
        tx: FINAL_ENCODED_TX,
        caip2ChainId: 'eip155:8453',
        option: buildOption(),
      });
      expect(result.ok).toBe(false);
    });
  });
});

describe('checkWcPayEvmActionMatchesOrder — Permit2 approve shape', () => {
  const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
  const pad32 = (hex: string) =>
    hex.toLowerCase().replace('0x', '').padStart(64, '0');
  const approveData = ({
    spender = PERMIT2,
    amountHex,
  }: {
    spender?: string;
    amountHex: string;
  }) => `0x095ea7b3${pad32(spender)}${pad32(amountHex)}`;

  it('accepts an exact-amount approve to Permit2', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: approveData({ amountHex: (1_000_000).toString(16) }),
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'approve',
    });
  });

  it('accepts the customary unlimited approve', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: approveData({ amountHex: 'f'.repeat(64) }),
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'approve',
    });
  });

  it('accepts an approve amount above the order (lenient by decision)', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: approveData({ amountHex: (2_000_000).toString(16) }),
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: true,
      kind: 'approve',
    });
  });

  it('rejects an approve amount below the order', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: approveData({ amountHex: (999_999).toString(16) }),
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: false,
      reason: 'approve amount below order',
    });
  });

  it('rejects a zero approve amount', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: approveData({ amountHex: '0' }),
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: false,
      reason: 'approve amount below order',
    });
  });

  it('rejects an approve whose spender is not Permit2', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: approveData({
          spender: RECIPIENT,
          amountHex: (1_000_000).toString(16),
        }),
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: false,
      reason: 'approve spender is not Permit2',
    });
  });

  it('rejects a non-canonical spender word', () => {
    const option = buildOption();
    // high 12 bytes of the spender word must be zero — poison one nibble
    const data = `0x095ea7b3${'1'.padStart(1, '0')}${pad32(PERMIT2).slice(
      1,
    )}${pad32((1_000_000).toString(16))}`;
    const action = buildAction({
      tx: { from: SENDER, to: TOKEN, data, value: '0x0' },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: false,
      reason: 'non-canonical spender word',
    });
  });

  it('rejects an approve that also moves native value', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: approveData({ amountHex: (1_000_000).toString(16) }),
        value: '0x1',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: false,
      reason: 'approve carries native value',
    });
  });

  it('rejects approve calldata with trailing bytes', () => {
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        data: `${approveData({ amountHex: (1_000_000).toString(16) })}ff`,
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: false,
      reason: 'unrecognized calldata shape',
    });
  });
});

describe('approve amount word fail-closed', () => {
  it('rejects a non-hex amount word instead of passing it as NaN', () => {
    const PERMIT2_WORD = '000000000022d473030f116ddee9f6b43ac78ba3'.padStart(
      64,
      '0',
    );
    const option = buildOption();
    const action = buildAction({
      tx: {
        from: SENDER,
        to: TOKEN,
        // valid selector + spender word, amount word is not hex
        data: `0x095ea7b3${PERMIT2_WORD}${'z'.repeat(64)}`,
        value: '0x0',
      },
    });
    expect(checkWcPayEvmActionMatchesOrder({ action, option })).toEqual({
      ok: false,
      reason: 'invalid approve amount word',
    });
  });
});
