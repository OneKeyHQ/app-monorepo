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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { Currency } from '../Currency';

// Desktop / web token table footer: the low-value, risky and add-token rows
// follow the token rows directly and are laid out like them (12px padding, the
// 32px icon where token icons sit, the label on the symbol column).

const ROW_PADDING = 12;
// Trailing Swap button: 10px padding plus a 1px border. Rows keep its
// footprint so the low-value total ends on the token values' edge.
const SWAP_BUTTON_HORIZONTAL_INSET = 11;
const ICON_SIZE = 32;
// Low-value logos: four 14px coins at the corners of a 28px group, centered in
// the 32px slot so the group weighs like the round icons around it. Each is an
// 11px face in a 1.5px ring of the page color, which keeps touching coins
// apart; the first is on top.
const COIN_GROUP_SIZE = 28;
const COIN_SIZE = 14;
const COIN_RING = 1.5;
const COIN_FACE_SIZE = COIN_SIZE - 2 * COIN_RING;
const COIN_NEAR = (ICON_SIZE - COIN_GROUP_SIZE) / 2;
const COIN_FAR = COIN_NEAR + COIN_GROUP_SIZE - COIN_SIZE;
const COIN_SLOTS = [
  [COIN_NEAR, COIN_NEAR],
  [COIN_FAR, COIN_NEAR],
  [COIN_NEAR, COIN_FAR],
  [COIN_FAR, COIN_FAR],
] as const;
const RISK_DISC_SIZE = 14;

function FooterRow({
  testID,
  icon,
  label,
  labelAccessory,
  trailing,
  onPress,
}: {
  testID: string;
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
      // Keys on a control inside the row (the help button) are its own.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPress();
      }
    },
    [onPress],
  );
  return (
    <XStack
      role="button"
      tabIndex={0}
      testID={testID}
      h={48}
      px={ROW_PADDING}
      gap="$3"
      alignItems="center"
      borderRadius="$3"
      userSelect="none"
      cursor="default"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      onPress={onPress}
      onKeyDown={handleKeyDown}
    >
      <Stack aria-hidden pointerEvents="none">
        {icon}
      </Stack>
      <XStack flex={1} minWidth={0} alignItems="center" gap="$1">
        <SizableText
          flexShrink={1}
          minWidth={0}
          size="$bodyLg"
          numberOfLines={1}
        >
          {label}
        </SizableText>
        {labelAccessory}
      </XStack>
      {trailing}
      <SizableText
        size="$bodyMdMedium"
        px={SWAP_BUTTON_HORIZONTAL_INSET}
        opacity={0}
        pointerEvents="none"
        aria-hidden
      >
        {intl.formatMessage({ id: ETranslations.global_swap })}
      </SizableText>
    </XStack>
  );
}

// The first four low-value tokens as a pile of their logos. The pile always
// has four coins: a coin without a token, or whose logo is missing, stays
// plain gray.
function LowValueCoins({ tokens }: { tokens: IAccountToken[] }) {
  return (
    <Stack w={ICON_SIZE} h={ICON_SIZE}>
      {COIN_SLOTS.map(([left, top], index) => {
        const logoURI = tokens[index]?.logoURI;
        return (
          <Stack
            key={index}
            testID="token-list-footer-low-value-coin"
            position="absolute"
            left={left}
            top={top}
            zIndex={COIN_SLOTS.length - index}
            w={COIN_SIZE}
            h={COIN_SIZE}
            p={COIN_RING}
            borderRadius="$full"
            bg="$bgApp"
          >
            <Stack flex={1} borderRadius="$full" bg="$bgStrong">
              {logoURI ? (
                <Image
                  size={COIN_FACE_SIZE}
                  borderRadius="$full"
                  source={{ uri: logoURI }}
                  fallback={<Stack w={COIN_FACE_SIZE} h={COIN_FACE_SIZE} />}
                />
              ) : null}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}

// Risky tokens are set aside: a disc in caution stripes, like a closed-off
// area. Web only (CSS gradient), as is this footer.
function RiskIcon() {
  const theme = useTheme();
  const stripes = useMemo<CSSProperties>(
    () => ({
      backgroundImage: `repeating-linear-gradient(-45deg, ${theme.borderCautionSubdued.val} 0 3px, ${theme.bgCautionSubdued.val} 3px 7px)`,
    }),
    [theme.bgCautionSubdued.val, theme.borderCautionSubdued.val],
  );
  return (
    <Stack
      w={ICON_SIZE}
      h={ICON_SIZE}
      borderRadius="$full"
      overflow="hidden"
      alignItems="center"
      justifyContent="center"
      style={stripes}
    >
      {/* Lights the shield's cut-out mark; the shield overhangs it. */}
      <Stack
        position="absolute"
        left={(ICON_SIZE - RISK_DISC_SIZE) / 2}
        top={(ICON_SIZE - RISK_DISC_SIZE) / 2}
        w={RISK_DISC_SIZE}
        h={RISK_DISC_SIZE}
        borderRadius="$full"
        bg="$bgApp"
      />
      <Icon name="ShieldExclamationSolid" size="$4.5" color="$iconCaution" />
    </Stack>
  );
}

// What makes a token low-value, behind a "?" beside the label (as on the
// narrow layout's row). Its press is its own, not the row's.
function LowValueHelp({ lines }: { lines: readonly string[] }) {
  const intl = useIntl();
  const stopRowPress = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  }, []);
  return (
    <Stack onPress={stopRowPress}>
      <Popover
        placement="top-start"
        title={intl.formatMessage({ id: ETranslations.low_value_assets })}
        renderTrigger={
          <IconButton
            testID="token-list-footer-help-btn"
            aria-label={intl.formatMessage({
              id: ETranslations.global_learn_more,
            })}
            size="small"
            variant="tertiary"
            icon="QuestionmarkOutline"
          />
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
function AddTokenIcon() {
  return (
    <Stack
      w={ICON_SIZE}
      h={ICON_SIZE}
      borderRadius="$full"
      borderWidth={1.5}
      borderStyle="dashed"
      borderColor="$borderStrong"
      alignItems="center"
      justifyContent="center"
    >
      <Icon name="PlusLargeOutline" size="$4" color="$iconSubdued" />
    </Stack>
  );
}

export type ITokenListFooterRowsProps = {
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
  lowValue,
  risky,
  addToken,
}: ITokenListFooterRowsProps) {
  const intl = useIntl();
  return (
    <YStack>
      {lowValue ? (
        <FooterRow
          testID="token-list-footer-low-value-btn"
          icon={<LowValueCoins tokens={lowValue.tokens} />}
          labelAccessory={
            lowValue.help?.length ? (
              <LowValueHelp lines={lowValue.help} />
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
          icon={<RiskIcon />}
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
          icon={<AddTokenIcon />}
          label={intl.formatMessage({ id: ETranslations.add_token_label })}
          onPress={addToken.onPress}
        />
      ) : null}
    </YStack>
  );
}
