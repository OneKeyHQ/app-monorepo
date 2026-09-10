import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBorrowApy,
  IBorrowToken,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

import { ApyTextV2 } from './BorrowTableList/ApyTextV2';

const ACCESSIBILITY_ACTIVATE = [{ name: 'activate' }] as const;

function stripServerTypography(text?: IEarnText): IEarnText | undefined {
  return text ? { text: text.text } : undefined;
}

export type IBorrowPositionCardAction = {
  key: string;
  label: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export type IBorrowPositionCardProps = {
  token: IBorrowToken;
  tokenAmount?: IEarnText;
  fiatValue?: IEarnText;
  apyDetail?: IBorrowApy;
  statusLabel: string;
  statusBadgeType: IBadgeType;
  platformBonusApy?: {
    title: IEarnText;
    logoURI?: string;
  };
  collateral?: React.ReactNode;
  actions: IBorrowPositionCardAction[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  testID?: string;
  actionsTestID?: string;
};

export function BorrowPositionCard({
  token,
  tokenAmount,
  fiatValue,
  apyDetail,
  statusLabel,
  statusBadgeType,
  platformBonusApy,
  collateral,
  actions,
  isExpanded = false,
  onToggleExpand,
  testID,
  actionsTestID,
}: IBorrowPositionCardProps) {
  const reducedMotion = useReducedMotion();
  const isPressable = Boolean(onToggleExpand);
  // ListItem.Text's own pairing, which is what Earn's asset rows render
  // through: the title is $bodyLgMedium on $text, the subtitle $bodyMd on
  // $textSubdued. The fiat value is the title here and the token amount the
  // subtitle under it.
  //
  // Both arrive carrying the server's own typography, and EarnText spreads the
  // remote props last, so a caller's size and color are advisory everywhere
  // else in the app. Here they are not: the server stamps the amount as the
  // larger line and the fiat value as the smaller one, which is the opposite
  // hierarchy, so leaving it in place renders the title beneath its own
  // subtitle in weight. Keep the string, drop the styling.
  const amountText = stripServerTypography(tokenAmount);
  const fiatText = stripServerTypography(fiatValue);

  // The whole card is the pointer target, but it can't carry the button role:
  // the collateral Switch is a focusable role="switch" and ARIA forbids
  // interactive descendants inside role="button". The asset row below has no
  // interactive children, so it carries the semantics and the keyboard entry
  // point instead. It deliberately takes no onPress — that would make tamagui
  // attach press handling and claim the native touch responder, which would
  // stop the card's own pressStyle from ever firing.
  //
  // No explicit label: `accessible` merges the row's children into one node,
  // and a label would replace their text, so the balance and fiat value would
  // stop being announced. Letting it compose reads out the asset and both
  // amounts, then the button role and expanded state.
  const disclosureProps = isPressable
    ? ({
        'aria-expanded': isExpanded,
        accessible: true,
        accessibilityRole: 'button',
        accessibilityState: { expanded: isExpanded },
        // accessibilityActions, not onAccessibilityTap: that one is wired to
        // iOS accessibilityActivate only, and `accessible` collapses this
        // subtree into a single node whose TalkBack double-tap arrives as
        // ACTION_CLICK. With no onPress on the row (see above) the click has
        // nothing to land on and does not bubble, so Android screen readers
        // could not expand the card at all.
        accessibilityActions: ACCESSIBILITY_ACTIVATE,
        onAccessibilityAction: (event: {
          nativeEvent: { actionName: string };
        }) => {
          if (event.nativeEvent.actionName === 'activate') {
            onToggleExpand?.();
          }
        },
        // focusVisibleStyle, not focusStyle: the row takes DOM focus on every
        // pointer press, so a plain :focus ring boxes the asset row the moment
        // the card is tapped.
        focusVisibleStyle: {
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: 1,
        },
        // role and tabIndex are DOM-only; React warns about them on native.
        ...(platformEnv.isRuntimeBrowser
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onKeyDown: (event: {
                key: string;
                preventDefault: () => void;
              }) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleExpand?.();
                }
              },
            }
          : {}),
      } as const)
    : {};

  return (
    <YStack gap="$2">
      <YStack
        testID={testID}
        cursor={isPressable ? 'pointer' : undefined}
        // $bgSubdued, not $bgApp: the card has to read as a block against the
        // page, the way the e-mode bar below it already does. The fill is only
        // one step off the page background, so the hairline border stays.
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        borderCurve="continuous"
        p="$3"
        gap="$2"
        hoverStyle={isPressable ? { bg: '$bgHover' } : undefined}
        pressStyle={isPressable ? { bg: '$bgActive' } : undefined}
        onPress={onToggleExpand}
      >
        <XStack ai="center" jc="space-between" gap="$3">
          <XStack ai="center" gap="$2" flexShrink={1} minWidth={0}>
            <Badge badgeType={statusBadgeType} badgeSize="sm">
              {statusLabel}
            </Badge>
            {apyDetail ? <ApyTextV2 apyDetail={apyDetail} /> : null}
          </XStack>
          {collateral ? (
            <XStack ai="center" gap="$2.5" flexShrink={1} minWidth={0}>
              {collateral}
            </XStack>
          ) : null}
        </XStack>

        <XStack ai="center" gap="$3" py="$2" {...disclosureProps}>
          <Token size="lg" tokenImageUri={token.logoURI} />
          <YStack flex={1} minWidth={0} gap="$0.5">
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {token.symbol}
            </SizableText>
            {platformBonusApy ? (
              <XStack ai="center" gap="$1">
                <EarnText
                  text={platformBonusApy.title}
                  size="$bodySmMedium"
                  color="$textSuccess"
                  numberOfLines={1}
                />
                {platformBonusApy.logoURI ? (
                  <Image
                    src={platformBonusApy.logoURI}
                    width="$3.5"
                    height="$3.5"
                  />
                ) : null}
              </XStack>
            ) : null}
          </YStack>
          <XStack ai="center" gap="$2" flexShrink={0}>
            <YStack ai="flex-end">
              {fiatText ? (
                <EarnText
                  text={fiatText}
                  size="$bodyLgMedium"
                  color="$text"
                  numberOfLines={1}
                />
              ) : null}
              {amountText ? (
                <XStack ai="center" gap="$1">
                  <EarnText
                    text={amountText}
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={1}
                  />
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {token.symbol}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>
            {isPressable ? (
              // Following the disclosure-triangle convention: points inward from
              // the leading edge while collapsed, down once expanded. The row
              // already carries role="button" and an Icon takes no focus, so
              // this stays a signifier and not a second tap target.
              <Stack
                transition={reducedMotion ? undefined : 'quick'}
                animateOnly={ANIMATE_ONLY_TRANSFORM}
                rotate={isExpanded ? '0deg' : '-90deg'}
              >
                <Icon
                  name="ChevronDownSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </Stack>
            ) : null}
          </XStack>
        </XStack>
      </YStack>

      {isExpanded && actions.length ? (
        <XStack testID={actionsTestID} ai="center" gap="$4">
          {actions.map((action) => (
            <Button
              key={action.key}
              testID={action.testID}
              flex={1}
              size="large"
              variant={action.variant}
              disabled={action.disabled}
              onPress={action.onPress}
            >
              {action.label}
            </Button>
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
}
