import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Image, useTheme } from '@onekeyhq/components';
import { buildOptimizedImageSource } from '@onekeyhq/components/src/primitives/Image/optimization';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  numberFormat,
  numberFormatAsRenderText,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import type { IServerNetworkMatch } from '../../types';
import type {
  IdentityRow,
  LeadingVisual,
  NativeListTheme,
  TrailingAccessory,
  ValueTextSegment,
} from '@onekeyfe/react-native-native-list';

type INetworkCurrencyTextV2 = Pick<
  Extract<TrailingAccessory, { kind: 'value' }>,
  'text' | 'textSegments'
>;

export function getNetworkValueV2({
  network,
  accountNetworkValues,
  accountDeFiOverview,
}: {
  network: IServerNetwork;
  accountNetworkValues: Record<string, string>;
  accountDeFiOverview: Record<string, { netWorth: number }>;
}): string {
  if (network.isAllNetworks) {
    return Object.values(accountDeFiOverview)
      .reduce(
        (total, value) => total.plus(value?.netWorth ?? 0),
        Object.values(accountNetworkValues).reduce(
          (total, value) => total.plus(value ?? '0'),
          new BigNumber(0),
        ),
      )
      .toFixed();
  }
  if (accountNetworkValues[network.id] === undefined) {
    return '0';
  }
  return new BigNumber(accountNetworkValues[network.id] ?? '0')
    .plus(accountDeFiOverview[network.id]?.netWorth ?? 0)
    .toFixed();
}

export function getNetworkTitleMatchV2(
  network: IServerNetworkMatch,
): IdentityRow['titleMatch'] {
  // MatchSizeableText highlights the longest Fuse match, with an earlier
  // starting position breaking ties. Fuse's end position is inclusive.
  const match = network.titleMatch?.indices.reduce<
    readonly [number, number] | undefined
  >((best, current) => {
    if (
      !best ||
      current[1] - current[0] > best[1] - best[0] ||
      (current[1] - current[0] === best[1] - best[0] && current[0] < best[0])
    ) {
      return current;
    }
    return best;
  }, undefined);
  return match ? [{ start: match[0], end: match[1] + 1 }] : undefined;
}

export async function preloadNetworkImagesV2(networks: IServerNetwork[]) {
  if (!platformEnv.isNative) return true;
  const uris = [
    ...new Set(
      networks
        .filter(
          (network) =>
            !network.isAllNetworks &&
            !network.isCustomNetwork &&
            Boolean(network.logoURI),
        )
        .map((network) => network.logoURI),
    ),
  ];
  if (!uris.length) return true;
  return Image.preloadImages(
    uris.map((uri) => ({
      uri,
      width: 32,
      height: 32,
      optimize: true,
      cachePolicy: 'memory-disk',
    })),
  );
}

export function useNetworkListPresentationV2(sourceCurrency?: string) {
  const theme = useTheme();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();

  const nativeTheme = useMemo<NativeListTheme>(
    () => ({
      background: theme.bgApp.val,
      rowBackground: theme.bgApp.val,
      rowSelectedBackground: theme.bgActive.val,
      rowPressedBackground: theme.bgActive.val,
      subduedBackground: theme.bgSubdued.val,
      strongBackground: theme.bgStrong.val,
      primaryText: theme.text.val,
      secondaryText: theme.textSubdued.val,
      disabledText: theme.textDisabled.val,
      icon: theme.icon.val,
      iconSubdued: theme.iconSubdued.val,
      separator: theme.borderSubdued.val,
      accent: theme.bgAccent.val,
      positive: theme.textSuccess.val,
      negative: theme.textCritical.val,
      criticalBackground: theme.bgCritical.val,
      inverseBackground: theme.bgInverse.val,
      inverseText: theme.textInverse.val,
      info: theme.textInfo.val,
      checkboxBackground: theme.bgPrimary.val,
      checkboxBorder: theme.borderStrong.val,
      checkboxIcon: theme.iconInverse.val,
    }),
    [theme],
  );

  const formatCurrencyValue = useCallback(
    (value: string): INetworkCurrencyTextV2 => {
      if (settingsValue.hideValue) return { text: '****' };
      const effectiveSource = sourceCurrency ?? currencyInfo.id;
      const effectiveTarget = currencyInfo.id;
      const convertedValue = convertFiat({
        value,
        sourceCurrency: effectiveSource,
        targetCurrency: effectiveTarget,
        currencyMap,
      });
      const options = {
        formatter: 'price' as const,
        formatterOptions: {
          currency:
            currencyMap[effectiveTarget]?.unit ??
            currencyMap[effectiveSource]?.unit,
        },
      };
      const rendered = numberFormatAsRenderText(convertedValue, options);
      if (typeof rendered === 'string') return { text: rendered };
      return {
        text: numberFormat(convertedValue, options),
        textSegments: rendered.map<ValueTextSegment>((segment) =>
          typeof segment === 'string'
            ? { text: segment }
            : {
                text: String(segment.value),
                ...(segment.type === 'sub' ? { style: 'subscript' } : {}),
              },
        ),
      };
    },
    [currencyInfo.id, currencyMap, settingsValue.hideValue, sourceCurrency],
  );

  const getNetworkLeading = useCallback(
    (network: IServerNetwork): LeadingVisual => {
      if (network.isAllNetworks) {
        return {
          kind: 'icon',
          name: 'AllNetworksSolid',
          tintColor: theme.iconActive.val,
        };
      }
      if (network.isCustomNetwork) {
        return {
          kind: 'network',
          shape: 'circle',
          fallbackText: network.name[0]?.toUpperCase() ?? '',
          backgroundColor: theme.bgInverse.val,
        };
      }
      const optimizedImage = platformEnv.isNative
        ? undefined
        : buildOptimizedImageSource({
            source: { uri: network.logoURI },
            resolvedSource: { uri: network.logoURI },
            width: 32,
            height: 32,
            allowRelativeUrl: platformEnv.isWeb || platformEnv.isWebEmbed,
          });
      return {
        kind: 'network',
        image: {
          uri: optimizedImage?.source?.uri ?? network.logoURI,
          retryTimes: 1,
          ...(optimizedImage?.optimized
            ? { fallbackUri: optimizedImage.rawUri }
            : {}),
          width: 32,
          height: 32,
          contentFit: 'cover',
          cachePolicy: 'memory-disk',
          loadingStrategy: 'skeleton',
        },
        shape: 'circle',
        backgroundColor: theme.bgApp.val,
        fallbackIcon: {
          name: 'GlobusOutline',
          tintColor: theme.iconSubdued.val,
        },
      };
    },
    [theme],
  );

  return {
    nativeTheme,
    formatCurrencyValue,
    getNetworkLeading,
    sectionBackground: theme.bg.val,
  };
}
