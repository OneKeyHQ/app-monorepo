import { useCallback, useMemo } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { Currency } from '../Currency';

import type { AccessibilityActionEvent } from 'react-native';

// Home token list footer: the low-value, risky and add-token rows follow the
// token rows directly and are laid out like them (12px padding, the icon where
// token icons sit, the label on the symbol column).

const ROW_PADDING = 12;
// Trailing Swap button: 10px padding plus a 1px border. Table rows keep its
// footprint so the low-value total ends on the token values' edge.
const SWAP_BUTTON_HORIZONTAL_INSET = 11;
const ACTIVATE_ACTIONS = [{ name: 'activate' as const }];

export type ITokenListFooterRowsLayout = 'table' | 'list';

type IFooterMetrics = {
  rowHeight: number;
  iconSize: number;
  // Low-value logos: four coins in a 2x2 group centered in the icon slot, so
  // the group weighs like the round icons around it. A small gap keeps them
  // apart; there is no ring around each face.
  coinSize: number;
  coinGap: number;
  riskIconSize: IIconProps['size'];
  addIconSize: IIconProps['size'];
  // Table rows hold the place of the token rows' trailing Swap button.
  swapColumn: boolean;
};

const FOOTER_METRICS: Record<ITokenListFooterRowsLayout, IFooterMetrics> = {
  // Desktop / web table: 32px icons in 48px rows.
  table: {
    rowHeight: 48,
    iconSize: 32,
    coinSize: 13,
    coinGap: 2,
    riskIconSize: '$4.5',
    addIconSize: '$4',
    swapColumn: true,
  },
  // Small screens: the 40px token icon in 56px rows, and no Swap column.
  list: {
    rowHeight: 56,
    iconSize: 40,
    coinSize: 17,
    coinGap: 2,
    riskIconSize: '$6',
    addIconSize: '$5',
    swapColumn: false,
  },
};

function FooterRow({
  testID,
  metrics,
  icon,
  label,
  trailing,
  onPress,
}: {
  testID: string;
  metrics: IFooterMetrics;
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  onPress: () => void;
}) {
  const intl = useIntl();
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPress();
      }
    },
    [onPress],
  );
  // VoiceOver and TalkBack focus the label on its own (the row is no
  // accessibility element there), so activating it opens the row.
  const nativeActivate = useMemo(
    () =>
      platformEnv.isNative
        ? {
            accessibilityActions: ACTIVATE_ACTIONS,
            onAccessibilityAction: (event: AccessibilityActionEvent) => {
              if (event.nativeEvent.actionName === 'activate') {
                onPress();
              }
            },
          }
        : undefined,
    [onPress],
  );
  return (
    // A press anywhere on the row opens it. For keyboards and screen readers
    // the button is the label.
    <XStack
      testID={testID}
      h={metrics.rowHeight}
      px={ROW_PADDING}
      gap="$3"
      alignItems="center"
      borderRadius="$3"
      userSelect="none"
      cursor="default"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <Stack aria-hidden pointerEvents="none">
        {icon}
      </Stack>
      <XStack flex={1} minWidth={0} alignItems="center">
        <Stack
          role="button"
          tabIndex={0}
          testID={`${testID}-label`}
          flexShrink={1}
          minWidth={0}
          // Room for the focus ring around the words.
          px="$1.5"
          mx="$-1.5"
          py="$1"
          my="$-1"
          borderRadius="$2"
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: -2,
          }}
          onKeyDown={handleKeyDown}
          {...nativeActivate}
        >
          <SizableText size="$bodyLg" numberOfLines={1}>
            {label}
          </SizableText>
        </Stack>
      </XStack>
      {trailing}
      {metrics.swapColumn ? (
        <SizableText
          size="$bodyMdMedium"
          px={SWAP_BUTTON_HORIZONTAL_INSET}
          opacity={0}
          pointerEvents="none"
          aria-hidden
        >
          {intl.formatMessage({ id: ETranslations.global_swap })}
        </SizableText>
      ) : null}
    </XStack>
  );
}

// The first four low-value tokens as a pile of their logos. The pile always
// has four coins: a coin without a token, or whose logo is missing, stays
// plain gray.
function LowValueCoins({
  tokens,
  metrics,
}: {
  tokens: IAccountToken[];
  metrics: IFooterMetrics;
}) {
  const { iconSize, coinSize, coinGap } = metrics;
  const near = (iconSize - 2 * coinSize - coinGap) / 2;
  const far = near + coinSize + coinGap;
  const slots = [
    [near, near],
    [far, near],
    [near, far],
    [far, far],
  ] as const;
  return (
    <Stack w={iconSize} h={iconSize}>
      {slots.map(([left, top], index) => {
        const logoURI = tokens[index]?.logoURI;
        return (
          <Stack
            key={index}
            testID="token-list-footer-low-value-coin"
            position="absolute"
            left={left}
            top={top}
            w={coinSize}
            h={coinSize}
            borderRadius="$full"
            bg="$bgStrong"
          >
            {logoURI ? (
              <Image
                size={coinSize}
                borderRadius="$full"
                source={{ uri: logoURI }}
                fallback={<Stack w={coinSize} h={coinSize} />}
              />
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}

// Risky tokens are set aside: a shield in the red of the risk assets page's
// notice, never the tokens' own logos (they often copy real ones).
function RiskIcon({ metrics }: { metrics: IFooterMetrics }) {
  return (
    <Stack
      w={metrics.iconSize}
      h={metrics.iconSize}
      borderRadius="$full"
      bg="$bgCritical"
      alignItems="center"
      justifyContent="center"
    >
      <Icon
        name="ShieldExclamationSolid"
        size={metrics.riskIconSize}
        color="$iconCritical"
      />
    </Stack>
  );
}

// An empty coin to put a token in.
function AddTokenIcon({ metrics }: { metrics: IFooterMetrics }) {
  return (
    <Stack
      w={metrics.iconSize}
      h={metrics.iconSize}
      borderRadius="$full"
      borderWidth={1.5}
      borderStyle="dashed"
      borderColor="$borderStrong"
      alignItems="center"
      justifyContent="center"
    >
      <Icon
        name="PlusLargeOutline"
        size={metrics.addIconSize}
        color="$iconSubdued"
      />
    </Stack>
  );
}

export type ITokenListFooterRowsProps = {
  // `table` beside the desktop / web token table, `list` on small screens.
  layout?: ITokenListFooterRowsLayout;
  lowValue?: {
    tokens: IAccountToken[];
    count: number;
    total?: string;
    // Under one cent the total reads as the folding rule, so it is left out.
    showTotal: boolean;
    onPress: () => void;
  };
  risky?: { count: number; onPress: () => void };
  addToken?: { onPress: () => void };
};

export function TokenListFooterRows({
  layout = 'table',
  lowValue,
  risky,
  addToken,
}: ITokenListFooterRowsProps) {
  const intl = useIntl();
  const metrics = FOOTER_METRICS[layout];
  return (
    <YStack>
      {lowValue ? (
        <FooterRow
          testID="token-list-footer-low-value-btn"
          metrics={metrics}
          icon={<LowValueCoins tokens={lowValue.tokens} metrics={metrics} />}
          label={intl.formatMessage(
            { id: ETranslations.low_value_assets_count__title },
            { number: lowValue.count },
          )}
          trailing={
            lowValue.showTotal ? (
              <Currency
                size="$bodyLg"
                color="$textSubdued"
                formatter="value"
                sourceCurrency="usd"
                hideValue
                numberOfLines={1}
              >
                {lowValue.total}
              </Currency>
            ) : null
          }
          onPress={lowValue.onPress}
        />
      ) : null}
      {risky ? (
        <FooterRow
          testID="token-list-footer-risky-btn"
          metrics={metrics}
          icon={<RiskIcon metrics={metrics} />}
          label={intl.formatMessage(
            { id: ETranslations.risk_assets_count__title },
            { number: risky.count },
          )}
          onPress={risky.onPress}
        />
      ) : null}
      {addToken ? (
        <FooterRow
          testID="token-list-footer-add-token-btn"
          metrics={metrics}
          icon={<AddTokenIcon metrics={metrics} />}
          label={intl.formatMessage({ id: ETranslations.add_token_label })}
          onPress={addToken.onPress}
        />
      ) : null}
    </YStack>
  );
}
