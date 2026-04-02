import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IBorrowAsset } from '@onekeyhq/shared/types/staking';

import {
  type IBorrowAssetSelectAction,
  createBorrowAssetSelectPopoverContent,
} from '../../BorrowAssetSelectPopover';

import type {
  IBorrowActionType,
  ITokenSelectorMode,
  ITokenSelectorTriggerProps,
} from '../types';

export interface IUseTokenSelectorParams {
  action: IBorrowActionType;
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  tokenSymbol?: string;
  tokenImageUri?: string;
  networkLogoURI?: string;
  selectableAssets?: IBorrowAsset[];
  selectableAssetsLoading?: boolean;
  onTokenSelect?: (item: IBorrowAsset) => void;
  setAmountValue: (value: string) => void;
}

export function useTokenSelector({
  action,
  accountId,
  networkId,
  providerName,
  borrowMarketAddress,
  borrowReserveAddress,
  tokenSymbol,
  tokenImageUri,
  networkLogoURI,
  selectableAssets,
  selectableAssetsLoading,
  onTokenSelect,
  setAmountValue,
}: IUseTokenSelectorParams): {
  selectorMode: ITokenSelectorMode;
  handleOpenTokenSelector: () => void;
  tokenSelectorTriggerProps: ITokenSelectorTriggerProps;
} {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalStakingParamList>>();
  const intl = useIntl();

  // Determine selector mode based on action
  const selectorMode = useMemo<ITokenSelectorMode>(() => {
    if (action === 'supply' || action === 'borrow') {
      // Check if we have the required params for navigation
      if (accountId && networkId && providerName && borrowMarketAddress) {
        return 'navigation';
      }
      return 'disabled';
    }
    if (action === 'withdraw' || action === 'repay') {
      if (selectableAssets && selectableAssets.length > 1) {
        return 'popover';
      }
    }
    return 'disabled';
  }, [
    action,
    accountId,
    networkId,
    providerName,
    borrowMarketAddress,
    selectableAssets,
  ]);

  // Navigation mode handler (for supply/borrow)
  const handleOpenTokenSelector = useCallback(() => {
    if (selectorMode !== 'navigation') return;
    if (!accountId || !networkId || !providerName || !borrowMarketAddress)
      return;

    navigation.push(EModalStakingRoutes.BorrowTokenSelect, {
      accountId,
      networkId,
      provider: providerName,
      marketAddress: borrowMarketAddress,
      action,
      currentReserveAddress: borrowReserveAddress,
      onSelect: (item: IBorrowAsset) => {
        if (item.reserveAddress === borrowReserveAddress) return;
        navigation.setParams({
          reserveAddress: item.reserveAddress,
          symbol: item.token.symbol,
          logoURI: item.token.logoURI,
        });
      },
    });
  }, [
    selectorMode,
    accountId,
    networkId,
    providerName,
    borrowMarketAddress,
    borrowReserveAddress,
    action,
    navigation,
  ]);

  // Popover mode handler (for withdraw/repay)
  const handleTokenSelectInternal = useCallback(
    (item: IBorrowAsset) => {
      setAmountValue(''); // Clear input when switching token
      onTokenSelect?.(item);
    },
    [setAmountValue, onTokenSelect],
  );

  // Popover content for withdraw/repay
  const popoverContentRenderer = useMemo(() => {
    if (selectorMode !== 'popover' || !selectableAssets) return undefined;
    // Only withdraw/repay actions use popover mode, so action is safe to cast
    return createBorrowAssetSelectPopoverContent({
      assets: selectableAssets,
      isLoading: selectableAssetsLoading,
      selectedReserveAddress: borrowReserveAddress,
      action: action as IBorrowAssetSelectAction,
      onSelect: handleTokenSelectInternal,
    });
  }, [
    selectorMode,
    selectableAssets,
    selectableAssetsLoading,
    borrowReserveAddress,
    action,
    handleTokenSelectInternal,
  ]);

  const popoverTitle = useMemo(
    () => intl.formatMessage({ id: ETranslations.token_selector_title }),
    [intl],
  );

  // Build token selector trigger props
  const tokenSelectorTriggerProps = useMemo<ITokenSelectorTriggerProps>(() => {
    const baseProps: ITokenSelectorTriggerProps = {
      selectedTokenImageUri: tokenImageUri,
      selectedTokenSymbol: tokenSymbol?.toUpperCase(),
      selectedNetworkImageUri: networkLogoURI,
    };

    if (selectorMode === 'navigation') {
      return {
        ...baseProps,
        onPress: handleOpenTokenSelector,
        disabled: false,
      };
    }

    if (selectorMode === 'popover' && popoverContentRenderer) {
      return {
        ...baseProps,
        disabled: selectableAssetsLoading,
        popover: {
          title: popoverTitle,
          content: popoverContentRenderer,
        },
      };
    }

    return {
      ...baseProps,
      disabled: true,
    };
  }, [
    tokenImageUri,
    tokenSymbol,
    networkLogoURI,
    selectorMode,
    handleOpenTokenSelector,
    popoverContentRenderer,
    popoverTitle,
    selectableAssetsLoading,
  ]);

  return {
    selectorMode,
    handleOpenTokenSelector,
    tokenSelectorTriggerProps,
  };
}
