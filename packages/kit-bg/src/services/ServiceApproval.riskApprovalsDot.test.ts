import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import ServiceApproval from './ServiceApproval';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

const NOW = 1_800_000_000_000;
const DAY_MS = timerUtils.getTimeDurationMs({ day: 1 });
const ALL_NETWORK_ID = getNetworkIdsMap().onekeyall;
const ETH = 'evm--1';
const BSC = 'evm--56';
const HD_ACCOUNT = "hd-1--m/44'/60'/0'/0/0";
const HD_BSC_ACCOUNT = "hd-1--m/44'/60'/0'/0/0--bsc";
const HD_ALL_NETWORK_ACCOUNT = 'hd-1--allnetwork-0';
const IMPORTED_ACCOUNT = 'imported--60--0xabc';

type ITarget = { networkId: string; accountId: string };

function createService({
  reviewTimes = {},
  riskApprovals = [],
}: {
  reviewTimes?: Record<string, number>;
  riskApprovals?: ITarget[];
}) {
  const getDbAccountIdFromIndexedAccountId = jest.fn(
    async () => HD_ALL_NETWORK_ACCOUNT,
  );
  const service = new ServiceApproval({
    backgroundApi: {
      simpleDb: {
        approval: {
          getApprovalResurfaceDaysConfig: jest.fn(async () => ({
            approvalResurfaceDays: 14,
            approvalAlertResurfaceDays: 30,
          })),
          getRiskApprovalsLastReviewTimes: jest.fn(async (targets: ITarget[]) =>
            targets.map(
              ({ networkId, accountId }) =>
                reviewTimes[`${networkId}_${accountId}`],
            ),
          ),
        },
      },
      serviceAccount: { getDbAccountIdFromIndexedAccountId },
    },
  });
  const fetchAccountApprovals = jest
    .spyOn(service, 'fetchAccountApprovals')
    .mockResolvedValue({
      contractApprovals: [
        { networkId: ETH, accountId: HD_ACCOUNT, isRiskContract: false },
        ...riskApprovals.map((item) => ({ ...item, isRiskContract: true })),
      ],
    } as unknown as Awaited<
      ReturnType<ServiceApproval['fetchAccountApprovals']>
    >);
  return { service, getDbAccountIdFromIndexedAccountId, fetchAccountApprovals };
}

const reviewedDaysAgo = (days: number) => NOW - days * DAY_MS;

describe('ServiceApproval.shouldShowRiskApprovalsDot', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('single network', () => {
    const params = {
      networkId: ETH,
      accountId: HD_ACCOUNT,
      indexedAccountId: 'hd-1--0',
    };
    const riskApprovals = [{ networkId: ETH, accountId: HD_ACCOUNT }];

    it('stays hidden without risk approvals', async () => {
      const { service } = createService({});
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        false,
      );
    });

    it('shows the dot when never reviewed', async () => {
      const { service } = createService({ riskApprovals });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        true,
      );
    });

    it('hides the dot within the resurface window without fetching', async () => {
      const { service, fetchAccountApprovals } = createService({
        riskApprovals,
        reviewTimes: { [`${ETH}_${HD_ACCOUNT}`]: reviewedDaysAgo(29) },
      });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        false,
      );
      expect(fetchAccountApprovals).not.toHaveBeenCalled();
    });

    it('shows the dot again after the resurface window', async () => {
      const { service } = createService({
        riskApprovals,
        reviewTimes: { [`${ETH}_${HD_ACCOUNT}`]: reviewedDaysAgo(31) },
      });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        true,
      );
    });

    it('hides the dot when All Networks was reviewed for the HD account', async () => {
      const { service, getDbAccountIdFromIndexedAccountId } = createService({
        riskApprovals,
        reviewTimes: {
          [`${ALL_NETWORK_ID}_${HD_ALL_NETWORK_ACCOUNT}`]: reviewedDaysAgo(1),
        },
      });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        false,
      );
      expect(getDbAccountIdFromIndexedAccountId).toHaveBeenCalledWith({
        indexedAccountId: 'hd-1--0',
        networkId: ALL_NETWORK_ID,
        deriveType: 'default',
      });
    });

    it('hides the dot when All Networks was reviewed for an imported account', async () => {
      const { service, getDbAccountIdFromIndexedAccountId } = createService({
        riskApprovals: [{ networkId: ETH, accountId: IMPORTED_ACCOUNT }],
        reviewTimes: {
          [`${ALL_NETWORK_ID}_${IMPORTED_ACCOUNT}`]: reviewedDaysAgo(1),
        },
      });
      await expect(
        service.shouldShowRiskApprovalsDot({
          networkId: ETH,
          accountId: IMPORTED_ACCOUNT,
        }),
      ).resolves.toBe(false);
      expect(getDbAccountIdFromIndexedAccountId).not.toHaveBeenCalled();
    });

    it('still shows the dot when only another network was reviewed', async () => {
      const { service } = createService({
        riskApprovals,
        reviewTimes: { [`${BSC}_${HD_BSC_ACCOUNT}`]: reviewedDaysAgo(1) },
      });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        true,
      );
    });
  });

  describe('All Networks', () => {
    const params = {
      networkId: ALL_NETWORK_ID,
      accountId: HD_ALL_NETWORK_ACCOUNT,
      indexedAccountId: 'hd-1--0',
    };
    const riskApprovals = [
      { networkId: ETH, accountId: HD_ACCOUNT },
      { networkId: ETH, accountId: HD_ACCOUNT },
      { networkId: BSC, accountId: HD_BSC_ACCOUNT },
    ];

    it('hides the dot when All Networks was reviewed', async () => {
      const { service, fetchAccountApprovals } = createService({
        riskApprovals,
        reviewTimes: {
          [`${ALL_NETWORK_ID}_${HD_ALL_NETWORK_ACCOUNT}`]: reviewedDaysAgo(1),
        },
      });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        false,
      );
      expect(fetchAccountApprovals).not.toHaveBeenCalled();
    });

    it('hides the dot when every risky network was reviewed individually', async () => {
      const { service } = createService({
        riskApprovals,
        reviewTimes: {
          [`${ETH}_${HD_ACCOUNT}`]: reviewedDaysAgo(1),
          [`${BSC}_${HD_BSC_ACCOUNT}`]: reviewedDaysAgo(2),
        },
      });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        false,
      );
    });

    it('shows the dot when a risky network was not reviewed', async () => {
      const { service } = createService({
        riskApprovals,
        reviewTimes: { [`${ETH}_${HD_ACCOUNT}`]: reviewedDaysAgo(1) },
      });
      await expect(service.shouldShowRiskApprovalsDot(params)).resolves.toBe(
        true,
      );
    });
  });
});
