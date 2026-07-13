import { defaultAbiCoder } from '@ethersproject/abi';

import type { IToken } from '@onekeyhq/shared/types/token';
import { EApproveType, EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import {
  PERMIT2_APPROVE_SELECTOR,
  buildErc20ApproveEncodedTx,
  buildPermit2ApproveAction,
  buildPermit2ApproveEncodedTx,
} from './approveTransactionUtils';

import type { BigNumber as EthersBigNumber } from '@ethersproject/bignumber';

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

describe('buildPermit2ApproveEncodedTx', () => {
  test('encodes the on-chain Permit2 revoke example', () => {
    const encodedTx = buildPermit2ApproveEncodedTx({
      owner,
      spender,
      tokenAddress: tokenInfo.address,
      permit2Address,
      expirationSeconds,
    });

    expect(encodedTx).toMatchObject({
      from: owner,
      to: permit2Address,
      value: '0x0',
    });
    expect(encodedTx.data?.slice(0, 10)).toBe(PERMIT2_APPROVE_SELECTOR);
    expect(encodedTx.data).toBe(
      '0x87517c45000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000004c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006a6bb7fd',
    );

    const [decodedToken, decodedSpender, decodedAmount, decodedExpiration] =
      defaultAbiCoder.decode(
        ['address', 'address', 'uint160', 'uint48'],
        `0x${encodedTx.data?.slice(10) ?? ''}`,
      );
    expect((decodedToken as string).toLowerCase()).toBe(
      tokenInfo.address.toLowerCase(),
    );
    expect((decodedSpender as string).toLowerCase()).toBe(
      spender.toLowerCase(),
    );
    expect((decodedAmount as EthersBigNumber).toString()).toBe('0');
    expect((decodedExpiration as EthersBigNumber).toString()).toBe(
      expirationSeconds,
    );
  });
});

describe('buildErc20ApproveEncodedTx', () => {
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
    expect(encodedTx.data?.slice(0, 10)).toBe('0x095ea7b3');

    const [decodedSpender, decodedAmount] = defaultAbiCoder.decode(
      ['address', 'uint256'],
      `0x${encodedTx.data?.slice(10) ?? ''}`,
    );
    expect((decodedSpender as string).toLowerCase()).toBe(
      spender.toLowerCase(),
    );
    expect((decodedAmount as EthersBigNumber).toString()).toBe('1500000');
  });
});

describe('buildPermit2ApproveAction', () => {
  test('builds a local revoke action with the DApp spender', () => {
    const encodedTx = buildPermit2ApproveEncodedTx({
      owner,
      spender,
      tokenAddress: tokenInfo.address,
      permit2Address,
      expirationSeconds,
    });

    const action = buildPermit2ApproveAction({
      encodedTx,
      accountAddress: owner,
      owner,
      spender,
      amount: '0',
      tokenInfo,
      permit2Address,
      expirationSeconds,
    });

    expect(action).toMatchObject({
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: owner,
        to: permit2Address,
        amount: '0',
        icon: tokenInfo.logoURI,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        isInfiniteAmount: false,
        approveType: EApproveType.Approve,
      },
    });
    expect(action?.tokenApprove?.spender.toLowerCase()).toBe(spender);
    expect(action?.tokenApprove?.tokenIdOnNetwork.toLowerCase()).toBe(
      tokenInfo.address,
    );
  });

  test('rejects a different selector', () => {
    const encodedTx = buildPermit2ApproveEncodedTx({
      owner,
      spender,
      tokenAddress: tokenInfo.address,
      permit2Address,
      expirationSeconds,
    });

    expect(
      buildPermit2ApproveAction({
        encodedTx: {
          ...encodedTx,
          data: `0xdeadbeef${encodedTx.data?.slice(10) ?? ''}`,
        },
        accountAddress: owner,
        owner,
        spender,
        amount: '0',
        tokenInfo,
        permit2Address,
        expirationSeconds,
      }),
    ).toBeUndefined();
  });

  test.each([
    ['token', otherAddress, spender, '0', expirationSeconds],
    ['spender', tokenInfo.address, otherAddress, '0', expirationSeconds],
    ['amount', tokenInfo.address, spender, '1', expirationSeconds],
    ['expiration', tokenInfo.address, spender, '0', '1785444350'],
  ])(
    'rejects calldata with a mismatching %s argument',
    (
      _field,
      tokenAddress,
      encodedSpender,
      encodedAmount,
      encodedExpiration,
    ) => {
      const data = `${PERMIT2_APPROVE_SELECTOR}${defaultAbiCoder
        .encode(
          ['address', 'address', 'uint160', 'uint48'],
          [tokenAddress, encodedSpender, encodedAmount, encodedExpiration],
        )
        .slice(2)}`;

      expect(
        buildPermit2ApproveAction({
          encodedTx: {
            from: owner,
            to: permit2Address,
            value: '0x0',
            data,
          },
          accountAddress: owner,
          owner,
          spender,
          amount: '0',
          tokenInfo,
          permit2Address,
          expirationSeconds,
        }),
      ).toBeUndefined();
    },
  );

  test.each([
    ['target', { to: otherAddress }],
    ['sender', { from: otherAddress }],
    ['value', { value: '0x1' }],
  ])('rejects a mismatching transaction %s', (_field, txOverrides) => {
    const encodedTx = buildPermit2ApproveEncodedTx({
      owner,
      spender,
      tokenAddress: tokenInfo.address,
      permit2Address,
      expirationSeconds,
    });

    expect(
      buildPermit2ApproveAction({
        encodedTx: { ...encodedTx, ...txOverrides },
        accountAddress: owner,
        owner,
        spender,
        amount: '0',
        tokenInfo,
        permit2Address,
        expirationSeconds,
      }),
    ).toBeUndefined();
  });
});
