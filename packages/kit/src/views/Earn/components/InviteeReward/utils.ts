import type { IEarnSummaryV2 } from '@onekeyhq/shared/types/staking';

interface IEarnInviteeAccount {
  accountId: string;
  accountAddress: string;
}

interface ILoadEarnInviteeRewardDependencies {
  ethNetworkId: string;
  getEarnAccount: (params: {
    accountId: string;
    indexedAccountId?: string;
    networkId: string;
    btcOnlyTaproot?: boolean;
  }) => Promise<IEarnInviteeAccount | null>;
  getEarnSummaryV2: (params: {
    accountAddress: string;
    networkId: string;
  }) => Promise<IEarnSummaryV2>;
}

export type ILoadEarnInviteeRewardResult =
  | {
      status: 'success';
      data: IEarnSummaryV2;
      earnAccount: IEarnInviteeAccount;
    }
  | {
      status: 'no-wallet';
    }
  | {
      status: 'unsupported';
    }
  | {
      status: 'error';
    };

export async function loadEarnInviteeReward({
  accountId,
  indexedAccountId,
  dependencies,
}: {
  accountId?: string;
  indexedAccountId?: string;
  dependencies: ILoadEarnInviteeRewardDependencies;
}): Promise<ILoadEarnInviteeRewardResult> {
  if (!accountId && !indexedAccountId) {
    return { status: 'no-wallet' };
  }

  try {
    const earnAccount = await dependencies.getEarnAccount({
      accountId: accountId || '',
      indexedAccountId,
      networkId: dependencies.ethNetworkId,
      btcOnlyTaproot: true,
    });

    if (!earnAccount?.accountAddress) {
      return { status: 'unsupported' };
    }

    const data = await dependencies.getEarnSummaryV2({
      accountAddress: earnAccount.accountAddress,
      networkId: dependencies.ethNetworkId,
    });

    return {
      status: 'success',
      data,
      earnAccount,
    };
  } catch {
    return { status: 'error' };
  }
}
