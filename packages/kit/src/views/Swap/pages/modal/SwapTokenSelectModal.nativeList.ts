import BigNumber from 'bignumber.js';

import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import type {
  NativeListSnapshot,
  NativeListTheme,
  RowModel,
  ValueTextSegment,
} from '@onekeyfe/react-native-native-list';

type ISwapTokenItem = ISwapToken | IFuseResult<ISwapToken>;

type IBuildSwapTokenNativeListParams = {
  tokens: ISwapTokenItem[];
  theme: NativeListTheme;
  disabledNetworkIds: string[];
  searchKeyword?: string;
  isMediumScreen: boolean;
  isDesktopSelector: boolean;
  currencySymbol: string;
  oppositeToken?: ISwapToken;
  otherNetworkStartIndex: number;
  warningIndex: number;
  warningText: string;
  warningBorderWidth: number;
  searchSectionTitles?: {
    selectedNetwork: string;
    otherNetworks: string;
  };
};

function formatSwapListAmount(
  value: string,
  formatter: 'balance' | 'value',
  currency?: string,
): { text: string; segments?: readonly ValueTextSegment[] } {
  const rendered = numberFormatAsRenderText(value, {
    formatter,
    formatterOptions: { currency },
  });
  if (typeof rendered === 'string') return { text: rendered };
  const segments = rendered.map<ValueTextSegment>((part) =>
    typeof part === 'string'
      ? { text: part }
      : {
          text: String(part.value),
          ...(part.type === 'sub' ? { style: 'subscript' as const } : {}),
        },
  );
  return { text: segments.map((part) => part.text).join(''), segments };
}

export function buildSwapTokenNativeListSnapshot({
  tokens,
  theme,
  disabledNetworkIds,
  searchKeyword,
  isMediumScreen,
  isDesktopSelector,
  currencySymbol,
  oppositeToken,
  otherNetworkStartIndex,
  warningIndex,
  warningText,
  warningBorderWidth,
  searchSectionTitles,
}: IBuildSwapTokenNativeListParams): {
  snapshot: NativeListSnapshot;
  tokensByKey: Map<string, ISwapToken>;
} {
  const rows: RowModel[] = [];
  const tokensByKey = new Map<string, ISwapToken>();
  tokens.forEach((item, index) => {
    const token = (item as IFuseResult<ISwapToken>).item
      ? (item as IFuseResult<ISwapToken>).item
      : (item as ISwapToken);
    const key = `token:${token.networkId}:${token.contractAddress}:${index}`;
    tokensByKey.set(key, token);
    let sectionTitle: string | undefined;
    if (index === otherNetworkStartIndex) {
      sectionTitle = searchSectionTitles?.otherNetworks;
    } else if (index === 0) {
      sectionTitle = searchSectionTitles?.selectedNetwork;
    }
    if (sectionTitle) {
      rows.push({
        key: `section:${index}`,
        type: 'sectionHeader',
        sectionKey: `section:${index}`,
        title: sectionTitle,
        height: 36,
        pressDisabled: true,
        style: {
          horizontalPadding: isDesktopSelector ? 4 : 20,
          title: {
            fontSize: 14,
            lineHeight: 20,
            color: theme.secondaryText,
            offsetY: 4,
          },
        },
      });
    }
    if (index === warningIndex) {
      if (!isDesktopSelector) {
        rows.push({
          key: 'warning-gap-before',
          type: 'system',
          variant: 'spacer',
          height: 12,
          pressDisabled: true,
        });
      }
      rows.push({
        key: 'unverified-token-warning',
        type: 'message',
        title: '',
        body: warningText,
        time: '',
        bodyLines: 0,
        presentation: 'inlineWarning',
        pressDisabled: true,
        leading: {
          kind: 'icon',
          name: 'InfoCircleOutline',
          tintColor: theme.iconSubdued,
        },
        style: {
          container: {
            backgroundColor: theme.subduedBackground,
            borderWidth: warningBorderWidth,
            borderColor: theme.separator,
          },
          horizontalPadding: 20,
          verticalPadding: 14,
          leadingGap: 8,
          image: { width: 20, height: 20 },
          body: {
            fontSize: 14,
            lineHeight: 20,
            fontWeight: 'medium',
            color: theme.primaryText,
          },
        },
      });
      if (!isDesktopSelector) {
        rows.push({
          key: 'warning-gap-after',
          type: 'system',
          variant: 'spacer',
          height: 8,
          pressDisabled: true,
        });
      }
    }
    const disabled = disabledNetworkIds.includes(token.networkId);
    const balance = new BigNumber(token.balanceParsed ?? 0);
    const fiatValue = new BigNumber(token.fiatValue ?? 0);
    const formattedBalance =
      !balance.isZero() && token.balanceParsed
        ? formatSwapListAmount(token.balanceParsed, 'balance')
        : undefined;
    const formattedValue =
      !fiatValue.isZero() && token.fiatValue
        ? formatSwapListAmount(token.fiatValue, 'value', currencySymbol)
        : undefined;
    const badgeText =
      oppositeToken &&
      token.freeFeeObject?.tokenList?.some((feeToken) =>
        equalTokenNoCaseSensitive({
          token1: oppositeToken,
          token2: feeToken,
        }),
      )
        ? token.freeFeeObject?.tag
        : undefined;
    const titleMatch = (item as IFuseResult<ISwapToken>).matches
      ?.find((match) => match.key === 'symbol')
      ?.indices.map(([start, end]) => ({ start, end: end + 1 }));
    const address = isMediumScreen
      ? accountUtils.shortenAddress({ address: token.contractAddress })
      : token.contractAddress;
    rows.push({
      key,
      type: 'identity',
      height: searchKeyword ? 76 : 60,
      opacity: disabled ? 0.5 : 1,
      leading: {
        kind: 'token',
        image: token.logoURI
          ? { uri: token.logoURI, width: 40, height: 40 }
          : undefined,
        networkImage: token.networkLogoURI
          ? { uri: token.networkLogoURI, width: 16, height: 16 }
          : undefined,
        fallbackIcon: {
          name: 'CryptoCoinOutline',
          tintColor: theme.iconSubdued,
        },
      },
      title: token.symbol,
      titleMatch,
      subtitle: token.name,
      tertiary: searchKeyword
        ? accountUtils.shortenAddress({
            address,
            leadingLength: 8,
            trailingLength: 6,
          })
        : undefined,
      badges: badgeText
        ? [{ key: 'fee', text: badgeText, tone: 'success' }]
        : undefined,
      trailing: [
        {
          kind: 'valuePair',
          primary: formattedBalance?.text ?? '',
          secondary: formattedValue?.text ?? '',
          primaryTextSegments: formattedBalance?.segments,
          secondaryTextSegments: formattedValue?.segments,
        },
        {
          kind: 'icon',
          name: 'DotVerSolid',
          buttonStyle: 'tertiary',
          actionKey: 'menu',
          disabled: token.isNative,
        },
      ],
      style: {
        horizontalPadding: isDesktopSelector ? 4 : 20,
        leadingGap: 12,
        trailingGap: 8,
        image: { width: 40, height: 40, shape: 'circle' },
        title: { fontSize: 16, lineHeight: 24, fontWeight: 'medium' },
        subtitle: { fontSize: 14, lineHeight: 20 },
        tertiary: {
          fontSize: 14,
          lineHeight: 20,
          color: theme.disabledText,
        },
      },
    });
  });
  return {
    snapshot: {
      schemaVersion: 1,
      generation: 1,
      layout: {
        kind: 'linear',
        contentPaddingHorizontal: isDesktopSelector ? 16 : 0,
      },
      selection: { mode: 'none', selectedKeys: [] },
      theme,
      rows,
    },
    tokensByKey,
  };
}
