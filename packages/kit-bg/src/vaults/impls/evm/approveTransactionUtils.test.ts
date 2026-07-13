import { defaultAbiCoder } from '@ethersproject/abi';

import type { IToken } from '@onekeyhq/shared/types/token';
import { EApproveType, EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import {
  PERMIT2_APPROVE_SELECTOR,
  buildErc20ApproveEncodedTx,
  buildPermit2ApproveAction,
  buildPermit2ApproveEncodedTx,
} from './approveTransactionUtils';

const owner = '0x4dbc53389b9ef869629e88b4ebe82e33dfc8ac61';
const permit2Address = '0x000000000022d473030f116ddee9f6b43ac78ba3';
const spender = '0x4c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca';
const otherAddress = '0x1111111111111111111111111111111111111111';
const expirationSeconds = '1785444349';
const tokenInfo: IToken = {
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC',
  logoURI: 'https://example.com/usdc.png',
  isNative: false,
};

function buildPermit2Tx() {
  return buildPermit2ApproveEncodedTx({
    owner,
    spender,
    tokenAddress: tokenInfo.address,
    permit2Address,
    expirationSeconds,
  });
}

function buildAction(encodedTx = buildPermit2Tx()) {
  return buildPermit2ApproveAction({
    encodedTx,
    accountAddress: owner,
    owner,
    spender,
    amount: '0',
    tokenInfo,
    permit2Address,
    expirationSeconds,
  });
}

describe('approval transaction utils', () => {
  test('encodes the on-chain Permit2 revoke example', () => {
    expect(buildPermit2Tx()).toEqual({
      from: owner,
      to: permit2Address,
      value: '0x0',
      data: '0x87517c45000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000004c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006a6bb7fd',
    });
  });

  test('keeps standard ERC20 approve encoding unchanged', () => {
    const encodedTx = buildErc20ApproveEncodedTx({
      owner,
      spender,
      amount: '1.5',
      tokenInfo,
    });

    expect(encodedTx).toMatchObject({
      from: owner,
      to: tokenInfo.address,
      value: '0x0',
    });
    expect(encodedTx.data).toBe(
      `0x095ea7b3${defaultAbiCoder
        .encode(['address', 'uint256'], [spender, '1500000'])
        .slice(2)}`,
    );
  });

  test('builds the verified local Permit2 revoke action', () => {
    const action = buildAction();

    expect(action).toMatchObject({
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: owner,
        to: permit2Address,
        amount: '0',
        isInfiniteAmount: false,
        approveType: EApproveType.Approve,
      },
    });
    expect(action?.tokenApprove?.spender.toLowerCase()).toBe(spender);
    expect(action?.tokenApprove?.tokenIdOnNetwork.toLowerCase()).toBe(
      tokenInfo.address,
    );
  });

  test.each(['selector', 'target', 'calldata'] as const)(
    'rejects a mismatching %s',
    (field) => {
      const encodedTx = buildPermit2Tx();
      let invalidTx = encodedTx;
      if (field === 'selector') {
        invalidTx = {
          ...encodedTx,
          data: `0xdeadbeef${encodedTx.data?.slice(10) ?? ''}`,
        };
      } else if (field === 'target') {
        invalidTx = { ...encodedTx, to: otherAddress };
      } else {
        invalidTx = {
          ...encodedTx,
          data: `${PERMIT2_APPROVE_SELECTOR}${defaultAbiCoder
            .encode(
              ['address', 'address', 'uint160', 'uint48'],
              [tokenInfo.address, spender, '1', expirationSeconds],
            )
            .slice(2)}`,
        };
      }

      expect(buildAction(invalidTx)).toBeUndefined();
    },
  );
});
