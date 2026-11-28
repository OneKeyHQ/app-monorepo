/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import {
  EClaimType,
  type IEarnClaimActionIcon,
  type IEarnPortfolioAsset,
  type IEarnText,
  type IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { PortfolioTabContent } from './PortfolioTabContent';

let mockIsDesktopLayout: boolean;
const mockHandleAction = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: jest.fn() }),
}));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: ({
      children,
      disabled,
      onPress,
    }: {
      children: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) => (
      <button type="button" disabled={disabled} onClick={onPress}>
        {children}
      </button>
    ),
    Divider: () => null,
    NumberSizeableText: Container,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    useMedia: () => ({ gtSm: mockIsDesktopLayout }),
  };
});
jest.mock('@onekeyhq/kit/src/components/ListView/TableList', () => ({
  TableList: ({
    columns,
    data: [asset],
    expandable,
  }: {
    columns: ITableColumn<IEarnPortfolioAsset>[];
    data: IEarnPortfolioAsset[];
    expandable?: {
      renderExpandedContent: (asset: IEarnPortfolioAsset) => ReactNode;
    };
  }) =>
    expandable
      ? expandable.renderExpandedContent(asset)
      : columns.find(({ key }) => key === 'Claimable')?.render(asset, 0),
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => jest.fn());
jest.mock('@onekeyhq/shared/src/locale', () => ({ ETranslations: {} }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({ isNative: false }));
jest.mock('@onekeyhq/shared/src/routes', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  isEtherFiProvider: () => false,
  isMorphoProvider: () => false,
  isPendleProvider: () => false,
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({}));
jest.mock('../../../components/Currency', () => ({
  useCurrency: () => ({ symbol: '$' }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
}));
jest.mock('../../Staking/components/ProtocolDetails/EarnText', () => ({
  EarnText: ({ text }: { text?: IEarnText }) => <span>{text?.text}</span>,
}));
jest.mock('../../Staking/components/ProtocolDetails/EarnTooltip', () => ({
  EarnTooltip: ({ tooltip }: { tooltip?: IEarnTooltip }) =>
    tooltip?.type === 'text' ? <span>{tooltip.data.title?.text}</span> : null,
}));
jest.mock('../../Staking/components/StakingActivityIndicator', () => ({}));
jest.mock('../../Staking/utils/utils', () => ({
  buildLocalTxStatusSyncId: jest.fn(),
}));
jest.mock('../earnUtils', () => ({}));
jest.mock('../hooks/usePortfolioAction', () => ({
  usePortfolioAction: () => ({ handleAction: mockHandleAction }),
}));
jest.mock('../hooks/useStakingPendingTxs', () => ({
  useStakingPendingTxsByInfo: () => ({}),
}));

describe('PortfolioTabContent rewards', () => {
  it.each([
    { layout: 'desktop table', isDesktop: true },
    { layout: 'mobile expanded row', isDesktop: false },
  ])('renders a reward without a button in the $layout', ({ isDesktop }) => {
    mockIsDesktopLayout = isDesktop;
    mockHandleAction.mockClear();

    const network = { networkId: 'evm--1', name: 'Ethereum', logoURI: '' };
    const protocol = {
      providerDetail: { code: 'aave', name: 'Aave', logoURI: '' },
    };
    const claimButton: IEarnClaimActionIcon = {
      type: EClaimType.Claim,
      disabled: false,
      text: { text: 'Claim reward' },
    };
    const asset: IEarnPortfolioAsset = {
      token: { info: { symbol: 'ETH', logoURI: '' } },
      metadata: { network, protocol },
      deposit: { title: { text: '1 ETH' }, description: { text: '$1000' } },
      earnings24h: { title: { text: '$1' } },
      assetsStatus: [],
      buttons: [],
      rewardAssets: [
        {
          title: { text: '5 points' },
          description: { text: 'Pending accrual' },
          tooltip: {
            type: 'text',
            data: { title: { text: 'Reward information' } },
          },
        },
        {
          title: { text: '2 AAVE' },
          description: { text: 'Available now' },
          button: claimButton,
        },
      ],
    };

    render(
      <PortfolioTabContent
        portfolioData={{
          investments: [
            {
              assets: [asset],
              airdropAssets: [],
              network,
              protocol,
              totalFiatValue: '1000',
              earnings24hFiatValue: '1',
            },
          ],
          earnTotalFiatValue: new BigNumber(1000),
          earnTotalEarnings24hFiatValue: new BigNumber(1),
          cachedOverviewTotalFiatValue: undefined,
          cachedOverviewEarnings24h: undefined,
          isLoading: false,
          refresh: jest.fn(),
        }}
      />,
    );

    expect(screen.getByText('5 points')).toBeTruthy();
    expect(screen.getByText('Pending accrual')).toBeTruthy();
    expect(screen.getByText('Reward information')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Claim reward' }));
    expect(mockHandleAction).toHaveBeenCalledTimes(1);
    expect(mockHandleAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionIcon: claimButton }),
    );
  });
});
