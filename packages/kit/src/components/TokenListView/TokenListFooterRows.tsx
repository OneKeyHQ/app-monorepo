import { useCallback, useMemo } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  Image,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
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
// The small "?" button is a 30 circle over a 20 footprint.
const HELP_BUTTON_FOOTPRINT = 20;
const COIN_COUNT = 4;
const ACTIVATE_ACTIONS = [{ name: 'activate' as const }];

export type ITokenListFooterRowsLayout = 'table' | 'list';

type IFooterMetrics = {
  rowHeight: number;
  iconSize: number;
  // Low-value logos: four coins at the corners of a group centered in the
  // icon slot, so the group weighs like the round icons around it. Each face
  // sits in a ring of clear space, which keeps touching coins apart.
  coinGroupSize: number;
  coinSize: number;
  coinRing: number;
  // Risk disc: caution stripes (band, then gap) behind a shield whose cut-out
  // mark is lit by a small page-colored disc.
  stripeBand: number;
  stripeGap: number;
  riskDiscSize: number;
  riskIconSize: IIconProps['size'];
  addIconSize: IIconProps['size'];
  // Hit target of the "?" beside the low-value label.
  helpTarget: number;
  // Table rows hold the place of the token rows' trailing Swap button.
  swapColumn: boolean;
};

const FOOTER_METRICS: Record<ITokenListFooterRowsLayout, IFooterMetrics> = {
  // Desktop / web table: 32px icons in 48px rows.
  table: {
    rowHeight: 48,
    iconSize: 32,
    coinGroupSize: 28,
    coinSize: 14,
    coinRing: 1.5,
    stripeBand: 3,
    stripeGap: 4,
    riskDiscSize: 14,
    riskIconSize: '$4.5',
    addIconSize: '$4',
    helpTarget: 40,
    swapColumn: true,
  },
  // Small screens: the 40px token icon in 56px rows, a touch-sized "?", and no
  // Swap column.
  list: {
    rowHeight: 56,
    iconSize: 40,
    coinGroupSize: 36,
    coinSize: 18,
    coinRing: 2,
    stripeBand: 4,
    stripeGap: 5,
    riskDiscSize: 18,
    riskIconSize: '$6',
    addIconSize: '$5',
    helpTarget: 44,
    swapColumn: false,
  },
};

function FooterRow({
  testID,
  metrics,
  icon,
  label,
  labelAccessory,
  trailing,
  onPress,
}: {
  testID: string;
  metrics: IFooterMetrics;
  icon: ReactNode;
  label: string;
  // Right after the label, e.g. the low-value help button.
  labelAccessory?: ReactNode;
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
    // the button is the label, so a control after it (the low-value "?")
    // stays a control of its own rather than a part of it.
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
      <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
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
        {labelAccessory}
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
  const { iconSize, coinGroupSize, coinSize, coinRing } = metrics;
  const near = (iconSize - coinGroupSize) / 2;
  const far = near + coinGroupSize - coinSize;
  const slots = [
    [near, near],
    [far, near],
    [near, far],
    [far, far],
  ] as const;
  const faceSize = coinSize - 2 * coinRing;
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
            zIndex={COIN_COUNT - index}
            w={coinSize}
            h={coinSize}
            // A clear gap, not a page-colored ring: the faces sit on the
            // row's own plate, so its hover tint does not swallow them.
            p={coinRing}
            borderRadius="$full"
          >
            <Stack flex={1} borderRadius="$full" bg="$bgStrong">
              {logoURI ? (
                <Image
                  size={faceSize}
                  borderRadius="$full"
                  source={{ uri: logoURI }}
                  fallback={<Stack w={faceSize} h={faceSize} />}
                />
              ) : null}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}

// Native has no CSS gradients: the same stripes as bands across a square
// turned 45 degrees, clipped by the disc.
function NativeCautionStripes({
  size,
  band,
  gap,
}: {
  size: number;
  band: number;
  gap: number;
}) {
  const span = Math.ceil(size * Math.SQRT2);
  const offset = (size - span) / 2;
  const count = Math.ceil(span / (band + gap));
  return (
    <XStack
      position="absolute"
      left={offset}
      top={offset}
      w={span}
      h={span}
      gap={gap}
      rotate="45deg"
    >
      {Array.from({ length: count }, (_, index) => (
        <Stack key={index} w={band} h={span} bg="$borderCautionSubdued" />
      ))}
    </XStack>
  );
}

// Risky tokens are set aside: a disc in caution stripes, like a closed-off
// area.
function RiskIcon({ metrics }: { metrics: IFooterMetrics }) {
  const theme = useTheme();
  const { iconSize, stripeBand, stripeGap, riskDiscSize, riskIconSize } =
    metrics;
  const stripes = useMemo<CSSProperties>(
    () => ({
      backgroundImage: `repeating-linear-gradient(-45deg, ${
        theme.borderCautionSubdued.val
      } 0 ${stripeBand}px, ${theme.bgCautionSubdued.val} ${stripeBand}px ${
        stripeBand + stripeGap
      }px)`,
    }),
    [
      theme.bgCautionSubdued.val,
      theme.borderCautionSubdued.val,
      stripeBand,
      stripeGap,
    ],
  );
  return (
    <Stack
      w={iconSize}
      h={iconSize}
      borderRadius="$full"
      overflow="hidden"
      alignItems="center"
      justifyContent="center"
      bg={platformEnv.isNative ? '$bgCautionSubdued' : undefined}
      style={platformEnv.isNative ? undefined : stripes}
    >
      {platformEnv.isNative ? (
        <NativeCautionStripes
          size={iconSize}
          band={stripeBand}
          gap={stripeGap}
        />
      ) : null}
      {/* Lights the shield's cut-out mark; the shield overhangs it. */}
      <Stack
        position="absolute"
        left={(iconSize - riskDiscSize) / 2}
        top={(iconSize - riskDiscSize) / 2}
        w={riskDiscSize}
        h={riskDiscSize}
        borderRadius="$full"
        bg="$bgApp"
      />
      <Icon
        name="ShieldExclamationSolid"
        size={riskIconSize}
        color="$iconCaution"
      />
    </Stack>
  );
}

// What makes a token low-value, behind a "?" beside the label. Its press is
// its own, not the row's.
function LowValueHelp({
  lines,
  metrics,
}: {
  lines: readonly string[];
  metrics: IFooterMetrics;
}) {
  const intl = useIntl();
  const stopRowPress = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  }, []);
  const helpButton = (
    <IconButton
      testID="token-list-footer-help-btn"
      aria-label={intl.formatMessage({
        id: ETranslations.low_value_assets,
      })}
      size="small"
      variant="tertiary"
      icon="QuestionmarkOutline"
    />
  );
  // Invisible padding around the button's footprint makes the target with
  // the same look and footprint, so a near miss on a touch screen opens the
  // help, not the list. Native buttons take the touch themselves, so there
  // the button is the trigger and its own hit slop widens it.
  const helpPadding = (metrics.helpTarget - HELP_BUTTON_FOOTPRINT) / 2;
  return (
    <Stack onPress={stopRowPress}>
      <Popover
        placement="top-start"
        title={intl.formatMessage({ id: ETranslations.low_value_assets })}
        renderTrigger={
          platformEnv.isNative ? (
            helpButton
          ) : (
            <Stack p={helpPadding} m={-helpPadding} borderRadius="$full">
              {helpButton}
            </Stack>
          )
        }
        renderContent={
          <YStack p="$5" gap="$2">
            {lines.map((text, index) => (
              <XStack key={index} gap="$2">
                <Stack
                  w="$1.5"
                  h="$1.5"
                  bg="$textSubdued"
                  borderRadius="$full"
                  mt="$2"
                />
                <SizableText size="$bodyMd">{text}</SizableText>
              </XStack>
            ))}
          </YStack>
        }
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
    // The help popover's lines; none leaves the "?" out.
    help?: readonly string[];
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
          labelAccessory={
            lowValue.help?.length ? (
              <LowValueHelp lines={lowValue.help} metrics={metrics} />
            ) : null
          }
          label={`${lowValue.count} ${intl.formatMessage({
            id: ETranslations.low_value_assets,
          })}`}
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
            { id: ETranslations.wallet_collapsed_risk_assets_number },
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
