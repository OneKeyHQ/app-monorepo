import approvalUtils from './approvalUtils';

import type { IContractApproval } from '../../types/approval';

const accountId = "hd-1--m/44'/60'/0'/0/0";
const networkId = 'evm--1';
const contractAddress = '0x1111111254eeb25477b68fb85ed929f73a960582';
const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const permit2Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

function buildContractApproval(): IContractApproval {
  const approval = {
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
      approval,
      { ...approval, permit2Address, expirationMs: 1_785_444_349_000 },
    ],
  };
}

describe('approvalUtils Permit2 helpers', () => {
  test('keeps ERC20 and Permit2 identities separate', () => {
    const erc20Key = approvalUtils.buildSelectedTokenKey({
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

    expect(
      approvalUtils.isPermit2Approval({
        approval: { permit2Address: undefined },
      }),
    ).toBe(false);
    expect(
      approvalUtils.isPermit2Approval({ approval: { permit2Address } }),
    ).toBe(true);
    expect(
      approvalUtils.hasPermit2ApprovalMetadata({
        approval: { expirationMs: 1_785_444_349_000 },
      }),
    ).toBe(true);
    expect(erc20Key).not.toBe(permit2Key);
    expect(
      approvalUtils.parseSelectedTokenKey({ selectedTokenKey: permit2Key }),
    ).toMatchObject({ permit2Address: permit2Address.toLowerCase() });
  });

  test('selects direct and Permit2 approvals independently', () => {
    const approvals = [buildContractApproval()];
    const selectedTokens = approvalUtils.buildToggleSelectAllTokensMap({
      approvals,
      toggle: true,
    });

    expect(Object.keys(selectedTokens)).toHaveLength(2);
    expect(
      approvalUtils.checkIsSelectAllTokens({ approvals, selectedTokens }),
    ).toEqual({
      isSelectAllTokens: true,
      totalCount: 2,
      selectedCount: 2,
    });
  });

  test('normalizes finite and uint48-max expirations', () => {
    expect(
      approvalUtils.normalizePermit2ExpirationMs(1_785_444_349_000),
    ).toEqual({
      expirationSeconds: '1785444349',
      isNeverExpires: false,
    });
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
