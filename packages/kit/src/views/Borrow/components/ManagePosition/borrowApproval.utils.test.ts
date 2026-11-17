import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  buildBorrowTokenApproveTarget,
  resolveBorrowApprovalType,
} from './borrowApproval.utils';

const token = {
  address: '0xweth',
  decimals: 18,
  isNative: false,
  networkId: 'evm--8453',
  symbol: 'WETH',
} as IToken;

describe('buildBorrowTokenApproveTarget', () => {
  it('uses the resolved spender passed down by the manage-page owner', () => {
    expect(
      buildBorrowTokenApproveTarget({
        accountId: 'account-id',
        networkId: 'evm--8453',
        spenderAddress: '0xaave-pool',
        token,
      }),
    ).toEqual({
      accountId: 'account-id',
      networkId: 'evm--8453',
      spenderAddress: '0xaave-pool',
      token,
    });
  });

  it('does not create an approval target for a native token', () => {
    expect(
      buildBorrowTokenApproveTarget({
        accountId: 'account-id',
        networkId: 'evm--8453',
        spenderAddress: '0xaave-pool',
        token: { ...token, isNative: true },
      }),
    ).toBeUndefined();
  });
});

describe('resolveBorrowApprovalType', () => {
  it('normalizes unsupported Permit metadata to the Borrow ERC20 path', () => {
    expect(resolveBorrowApprovalType(EApproveType.Permit)).toBe(
      EApproveType.Legacy,
    );
  });

  it('preserves Legacy and absent approval metadata', () => {
    expect(resolveBorrowApprovalType(EApproveType.Legacy)).toBe(
      EApproveType.Legacy,
    );
    expect(resolveBorrowApprovalType(undefined)).toBeUndefined();
  });
});
