/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type {
  IEarnStakeType,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';
import { ECheckAmountActionType } from '@onekeyhq/shared/types/staking';

import { getStakeTransactionConfirmationAction } from '../utils/utils';

import { usePendleLayoutState } from './usePendleLayoutState';

jest.mock('../components/ProtocolDetails/PendleSharedComponents', () => ({
  usePendleTransactionDetails: () => [],
}));

jest.mock('./useIsPendleProvider', () => ({
  useIsPendleProvider: (providerName: string) => providerName === 'pendle',
}));

const confirmation: IStakeTransactionConfirmation = {
  title: { text: 'Est. annual rewards' },
  rewards: [
    {
      title: { text: '0.0003 ETH' },
      description: { text: '$0.60' },
    },
  ],
  apyDetail: {
    type: 'default',
    token: {
      info: {
        uniqueKey: 'evm--1_ETH',
        address: '',
        decimals: 18,
        isNative: true,
        logoURI: '',
        name: 'Ethereum',
        symbol: 'ETH',
        totalSupply: '0',
        riskLevel: 0,
        coingeckoId: 'ethereum',
        networkId: 'evm--1',
      },
      price: '2000',
    },
    fiatValue: '0.60',
    formattedValue: '0.0003',
    badge: {
      badgeType: 'success',
      badgeSize: 'sm',
      text: { text: '3%' },
    },
    title: { text: 'APY' },
    description: { text: '3%' },
  },
  receive: {
    title: { text: 'Expected to receive' },
    description: { text: '0.01 WETH' },
  },
};

describe('stake confirmation summary visibility', () => {
  it('hides Permit approval yields while retaining the real Pendle stake quote lifecycle', () => {
    const { result, rerender } = renderHook(
      ({ shouldApprove }: { shouldApprove: boolean }) => {
        const action = getStakeTransactionConfirmationAction({
          shouldApprove,
          usePermitApprove: true,
          stakeType: 'normal',
        });
        return {
          action,
          ...usePendleLayoutState({
            providerName: 'pendle',
            transactionConfirmation: confirmation,
            amountValue: '0.01',
            action,
            hideYieldPreview: shouldApprove,
            showApyDetail: true,
            receiveInputConfig: { enabled: true },
            networkLogoURI: undefined,
            isQuoteExpired: true,
          }),
        };
      },
      { initialProps: { shouldApprove: true } },
    );

    expect(result.current.action).toBe(ECheckAmountActionType.STAKING);
    expect(result.current.hasSummarySection).toBe(false);
    expect(result.current.showExpiredRefresh).toBe(true);
    expect(result.current.showReceiveInput).toBe(true);
    rerender({ shouldApprove: false });
    expect(result.current.hasSummarySection).toBe(true);
    expect(result.current.action).toBe(ECheckAmountActionType.STAKING);
  });

  it.each(['native', 'etherfi', 'pendle'])(
    '%s approval hides stale yields and cannot be blocked by deposit quote expiry',
    (providerName) => {
      const { result, rerender } = renderHook(
        ({ shouldApprove }: { shouldApprove: boolean }) => {
          const action = getStakeTransactionConfirmationAction({
            shouldApprove,
            usePermitApprove: false,
            stakeType: 'normal',
          });
          return {
            action,
            ...usePendleLayoutState({
              providerName,
              transactionConfirmation: confirmation,
              amountValue: '0.01',
              action,
              stakeType: 'normal',
              showApyDetail: true,
              receiveInputConfig: { enabled: true },
              networkLogoURI: undefined,
              isQuoteExpired: true,
            }),
          };
        },
        { initialProps: { shouldApprove: true } },
      );

      expect(result.current.action).toBe('approve');
      expect(result.current.hasSummarySection).toBe(false);
      expect(result.current.showApyHeader).toBe(false);
      expect(result.current.showExpiredRefresh).toBe(false);

      rerender({ shouldApprove: false });

      expect(result.current.action).toBe(ECheckAmountActionType.STAKING);
      expect(result.current.hasSummarySection).toBe(true);
      expect(result.current.showApyHeader).toBe(providerName !== 'pendle');
      expect(result.current.showExpiredRefresh).toBe(providerName === 'pendle');
    },
  );

  it.each([
    { stakeType: 'wrap' as const, usePermitApprove: false },
    { stakeType: 'normal' as const, usePermitApprove: true },
  ])(
    'keeps $stakeType / permit=$usePermitApprove in the stake flow',
    (step) => {
      expect(
        getStakeTransactionConfirmationAction({ ...step, shouldApprove: true }),
      ).toBe(ECheckAmountActionType.STAKING);
    },
  );

  it.each(['native', 'etherfi'])(
    '%s hides stale annual rewards during wrap and restores normal deposit at the same amount',
    (providerName) => {
      const { result, rerender } = renderHook(
        ({ stakeType }: { stakeType: IEarnStakeType }) =>
          usePendleLayoutState({
            providerName,
            // Keep the prior response while the new request is in flight.
            transactionConfirmation: confirmation,
            amountValue: '0.01',
            stakeType,
            showApyDetail: true,
            receiveInputConfig: { enabled: true },
            networkLogoURI: undefined,
            isQuoteExpired: false,
          }),
        { initialProps: { stakeType: 'normal' } },
      );

      expect(result.current.hasSummarySection).toBe(true);
      expect(result.current.showApyHeader).toBe(true);

      rerender({ stakeType: 'wrap' });

      expect(result.current.hasSummarySection).toBe(false);
      expect(result.current.showApyHeader).toBe(false);
      expect(result.current.showReceiveInput).toBe(true);

      rerender({ stakeType: 'normal' });

      expect(result.current.hasSummarySection).toBe(true);
      expect(result.current.showApyHeader).toBe(true);
      expect(result.current.showReceiveInput).toBe(true);
    },
  );

  it('keeps legacy calls without stakeType unchanged', () => {
    const { result } = renderHook(() =>
      usePendleLayoutState({
        providerName: 'native',
        transactionConfirmation: confirmation,
        amountValue: '0.01',
        showApyDetail: true,
        receiveInputConfig: undefined,
        networkLogoURI: undefined,
        isQuoteExpired: false,
      }),
    );

    expect(result.current.hasSummarySection).toBe(true);
    expect(result.current.showApyHeader).toBe(true);
  });
});
