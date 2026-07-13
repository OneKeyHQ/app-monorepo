import approvalUtils from './approvalUtils';

import type { IContractApproval } from '../../types/approval';

const accountId = "hd-1--m/44'/60'/0'/0/0";
const networkId = 'evm--1';
const contractAddress = '0x1111111254eeb25477b68fb85ed929f73a960582';
const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const permit2Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

function buildContractApproval(): IContractApproval {
  const baseApproval = {
    tokenAddress,
    spenderAddress: contractAddress,
    networkId,
    allowance: '1',
    allowanceParsed: '1',
    isInfiniteAmount: false,
    time: 1,
    riskLevel: 0,
  };

  return {
    accountId,
    networkId,
    owner: '0x2541586A878Ad288C2819A68dc12B5fF874ce5cA',
    latestApprovalTime: 1,
    highestRiskLevel: 0,
    contractAddress,
    approvals: [
      baseApproval,
      {
        ...baseApproval,
        permit2Address,
        expirationMs: 1_785_444_349_000,
      },
    ],
  };
}

describe('approval selection identity', () => {
  test('does not classify a direct ERC20 approval to Permit2 as Permit2', () => {
    const directTokenToPermit2Approval = {
      tokenAddress,
      spenderAddress: permit2Address,
    };
    const permit2ToDappApproval = {
      tokenAddress,
      spenderAddress: contractAddress,
      permit2Address,
      expirationMs: 281_474_976_710_655_000,
    };

    expect(
      approvalUtils.isPermit2Approval({
        approval: {
          ...directTokenToPermit2Approval,
          permit2Address: undefined,
        },
      }),
    ).toBe(false);
    expect(
      approvalUtils.isPermit2Approval({
        approval: permit2ToDappApproval,
      }),
    ).toBe(true);
    expect(directTokenToPermit2Approval.spenderAddress.toLowerCase()).toBe(
      permit2Address.toLowerCase(),
    );
    expect(permit2ToDappApproval.spenderAddress).toBe(contractAddress);
  });

  test('detects partial Permit2 metadata as invalid rather than ERC20', () => {
    expect(
      approvalUtils.hasPermit2ApprovalMetadata({
        approval: {},
      }),
    ).toBe(false);
    expect(
      approvalUtils.hasPermit2ApprovalMetadata({
        approval: { expirationMs: 1_785_444_349_000 },
      }),
    ).toBe(true);
  });

  test('distinguishes ERC20 and Permit2 approvals for the same token', () => {
    const directKey = approvalUtils.buildSelectedTokenKey({
      accountId,
      networkId,
      contractAddress,
      tokenAddress,
    });
    const permit2Key = approvalUtils.buildSelectedTokenKey({
      accountId,
      networkId,
      contractAddress,
      tokenAddress,
      permit2Address,
    });

    expect(directKey).not.toBe(permit2Key);
    expect(directKey.endsWith('_erc20')).toBe(true);
    expect(permit2Key.endsWith(`_${permit2Address.toLowerCase()}`)).toBe(true);
    expect(
      approvalUtils.parseSelectedTokenKey({ selectedTokenKey: permit2Key }),
    ).toEqual({
      accountId,
      networkId,
      contractAddress,
      tokenAddress,
      permit2Address: permit2Address.toLowerCase(),
    });
  });

  test('counts ERC20 and Permit2 approvals independently', () => {
    const approval = buildContractApproval();
    const selectedTokens = approvalUtils.buildToggleSelectAllTokensMap({
      approvals: [approval],
      toggle: true,
    });

    expect(Object.keys(selectedTokens)).toHaveLength(2);
    expect(
      approvalUtils.checkIsSelectAllTokens({
        approvals: [approval],
        selectedTokens,
      }),
    ).toEqual({
      isSelectAllTokens: true,
      totalCount: 2,
      selectedCount: 2,
    });
  });
});

describe('normalizePermit2ExpirationMs', () => {
  test('normalizes a finite millisecond timestamp to ABI seconds', () => {
    expect(
      approvalUtils.normalizePermit2ExpirationMs(1_785_444_349_000),
    ).toEqual({
      expirationSeconds: '1785444349',
      isNeverExpires: false,
    });
  });

  test('recovers uint48 values after millisecond precision loss', () => {
    const nearMaxSeconds = 281_474_976_710_654;

    expect(
      approvalUtils.normalizePermit2ExpirationMs(nearMaxSeconds * 1000),
    ).toEqual({
      expirationSeconds: nearMaxSeconds.toString(),
      isNeverExpires: false,
    });
  });

  test('recognizes uint48 max as never expiring', () => {
    expect(
      approvalUtils.normalizePermit2ExpirationMs(281_474_976_710_655_000),
    ).toEqual({
      expirationSeconds: '281474976710655',
      isNeverExpires: true,
    });
  });

  test.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    281_474_976_710_656_000,
  ])('rejects invalid expiration value %s', (expirationMs) => {
    expect(
      approvalUtils.normalizePermit2ExpirationMs(expirationMs),
    ).toBeUndefined();
  });
});
