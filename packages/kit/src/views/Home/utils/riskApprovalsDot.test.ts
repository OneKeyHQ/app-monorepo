import { shouldShowRiskApprovalsDot } from './riskApprovalsDot';

const mockShouldShowRiskApprovalsAlert = jest.fn<
  Promise<boolean>,
  [{ accountId: string; networkId: string }]
>();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApproval: {
      shouldShowRiskApprovalsAlert: (params: {
        accountId: string;
        networkId: string;
      }) => mockShouldShowRiskApprovalsAlert(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    approval: { revokeSuggestion: { consoleError: jest.fn() } },
  },
}));

const params = { accountId: 'account-1', networkId: 'evm--1' };

describe('shouldShowRiskApprovalsDot', () => {
  beforeEach(() => {
    mockShouldShowRiskApprovalsAlert.mockReset();
  });

  it('stays hidden without risk approvals and skips the review lookup', async () => {
    await expect(
      shouldShowRiskApprovalsDot({
        ...params,
        contractApprovals: [{ isRiskContract: false }],
      }),
    ).resolves.toBe(false);
    expect(mockShouldShowRiskApprovalsAlert).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'follows the review resurface window (%s) for risk approvals',
    async (shouldShow) => {
      mockShouldShowRiskApprovalsAlert.mockResolvedValue(shouldShow);

      await expect(
        shouldShowRiskApprovalsDot({
          ...params,
          contractApprovals: [
            { isRiskContract: false },
            { isRiskContract: true },
          ],
        }),
      ).resolves.toBe(shouldShow);
      expect(mockShouldShowRiskApprovalsAlert).toHaveBeenCalledWith(params);
    },
  );

  it('shows the dot when the review state cannot be read', async () => {
    mockShouldShowRiskApprovalsAlert.mockRejectedValue(new Error('db'));

    await expect(
      shouldShowRiskApprovalsDot({
        ...params,
        contractApprovals: [{ isRiskContract: true }],
      }),
    ).resolves.toBe(true);
  });
});
