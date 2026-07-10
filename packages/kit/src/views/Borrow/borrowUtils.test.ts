import {
  EModalStakingRoutes,
  ETabEarnRoutes,
} from '@onekeyhq/shared/src/routes';

import { safePushToEarnRoute } from '../Earn/earnUtils';

import { BorrowNavigation } from './borrowUtils';

jest.mock('../Earn/earnUtils', () => ({
  safePushToEarnRoute: jest.fn(),
}));

describe('BorrowNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps token and provider logos distinct in reserve-details params', () => {
    const navigation = {} as Parameters<
      typeof BorrowNavigation.pushToBorrowReserveDetails
    >[0];

    BorrowNavigation.pushToBorrowReserveDetails(navigation, {
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: 'market-address',
      reserveAddress: 'reserve-address',
      symbol: 'USDC',
      logoURI: 'token-logo',
      providerLogoURI: 'provider-logo',
    });

    expect(safePushToEarnRoute).toHaveBeenCalledWith(
      navigation,
      ETabEarnRoutes.BorrowReserveDetails,
      expect.objectContaining({
        logoURI: 'token-logo',
        providerLogoURI: 'provider-logo',
      }),
    );
  });

  it('keeps provider identity when reserve details opens in a modal', () => {
    const push = jest.fn();
    const navigation = { push } as unknown as Parameters<
      typeof BorrowNavigation.pushToBorrowReserveDetails
    >[0];

    BorrowNavigation.pushToBorrowReserveDetails(navigation, {
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: 'market-address',
      reserveAddress: 'reserve-address',
      symbol: 'USDC',
      logoURI: 'token-logo',
      providerLogoURI: 'provider-logo',
      isModal: true,
    });

    expect(push).toHaveBeenCalledWith(
      EModalStakingRoutes.BorrowReserveDetails,
      expect.objectContaining({
        logoURI: 'token-logo',
        providerLogoURI: 'provider-logo',
      }),
    );
  });
});
