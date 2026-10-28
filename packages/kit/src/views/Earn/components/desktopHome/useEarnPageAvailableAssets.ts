import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useEarnActions,
  useEarnAtom,
  useEarnLoadingStatesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { mergeSimpleEarnWithStakingAssets } from '../../utils/availableAssetsUtils';

import { useContentStable } from './useContentStable';

const EMPTY_ASSETS: IEarnAvailableAsset[] = [];
const EMPTY_ASSETS_BY_TYPE: Partial<
  Record<EAvailableAssetsTypeEnum, IEarnAvailableAsset[]>
> = {};
const LIST_TYPES = [
  EAvailableAssetsTypeEnum.SimpleEarn,
  EAvailableAssetsTypeEnum.FixedRate,
  EAvailableAssetsTypeEnum.Staking,
] as const;

/**
 * The Earn lists a page of the DeFi home reads, Trending tokens (with
 * staking) and Fixed Income, from the Earn store the home fills. Opened
 * straight from its address, before the home ever loaded, the page asks for
 * the lists itself
 */
export function useEarnPageAvailableAssets() {
  const actions = useEarnActions();
  const [{ availableAssetsByType: atomAssetsByType }] = useEarnAtom();
  const availableAssetsByType = useContentStable(
    atomAssetsByType ?? EMPTY_ASSETS_BY_TYPE,
  );
  const [loadingStates] = useEarnLoadingStatesAtom();

  const askedRef = useRef(false);
  useEffect(() => {
    if (askedRef.current) {
      return;
    }
    askedRef.current = true;
    LIST_TYPES.forEach((type) => {
      if (
        availableAssetsByType[type] ||
        loadingStates[`availableAssets-${type}`]
      ) {
        return;
      }
      actions.current.setLoadingState(`availableAssets-${type}`, true);
      void backgroundApiProxy.serviceStaking
        .getAvailableAssets({ type })
        .catch(() => [] as IEarnAvailableAsset[])
        .then((assets) => {
          actions.current.updateAvailableAssetsByType(type, assets);
          actions.current.setLoadingState(`availableAssets-${type}`, false);
        });
    });
  }, [actions, availableAssetsByType, loadingStates]);

  const trendingAssets = useMemo(
    () =>
      mergeSimpleEarnWithStakingAssets(
        availableAssetsByType[EAvailableAssetsTypeEnum.SimpleEarn] ??
          EMPTY_ASSETS,
        availableAssetsByType[EAvailableAssetsTypeEnum.Staking] ?? EMPTY_ASSETS,
      ),
    [availableAssetsByType],
  );
  const fixedRateAssets =
    availableAssetsByType[EAvailableAssetsTypeEnum.FixedRate] ?? EMPTY_ASSETS;
  // A list not yet in counts as loading, so nothing reads it as empty
  const isAssetsLoading = LIST_TYPES.some(
    (type) =>
      Boolean(loadingStates[`availableAssets-${type}`]) ||
      !availableAssetsByType[type],
  );
  return { trendingAssets, fixedRateAssets, isAssetsLoading };
}
