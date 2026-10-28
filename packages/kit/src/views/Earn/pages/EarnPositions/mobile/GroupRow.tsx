import { Children, isValidElement, useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Accordion,
  Badge,
  Icon,
  SizableText,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { PendingIndicator } from '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator';

import { ANIMATE_ONLY_BG_COLOR } from '../../../components/desktopHome/earnDesktopColorEase';
import { buildKeyboardPressProps } from '../../../components/desktopHome/earnDesktopPressable';
import {
  LIST_HIDDEN_STYLE,
  getListHeightTransition,
  getListRowMotion,
} from '../../../utils/earnListMotion';

import { usePortfolioTableLayout } from './portfolioTableLayout';

/**
 * Which groups are open: only the ones the user opened (product: nothing
 * opens by itself). Lists on this page re-order while accounts load, so this
 * is kept as state keyed by group rather than inside each row, and a group
 * stays as the user left it wherever it lands. The wide layout opens every
 * group, as the wallet DeFi Portfolio's desktop cards do, and each can still
 * be closed.
 */
export function useGroupExpansion() {
  const defaultOpen = usePortfolioTableLayout();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const isExpanded = useCallback(
    (key: string) => opened[key] ?? defaultOpen,
    [opened, defaultOpen],
  );
  const toggle = useCallback(
    (key: string) => {
      setOpened((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen) }));
    },
    [defaultOpen],
  );
  const open = useCallback((key: string) => {
    setOpened((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);
  return { isExpanded, toggle, open };
}

export type IGroupExpansion = ReturnType<typeof useGroupExpansion>;

type IGroupRowProps = {
  name: string;
  logoURI?: string;
  /** shown as the network badge on the logo when the group is one network */
  networkId?: string;
  /** beside the name when another group has the same name, "Katana" */
  networkName?: string;
  total: React.ReactNode;
  /** under the name in the wide layout's card header, "3 Positions" */
  subtitle?: string;
  pendingCount?: number;
  expanded: boolean;
  onToggle: () => void;
  /** the wide layout's card, for the page to scroll to */
  anchorRef?: (node: HTMLElement | null) => void;
  /** a tile scrolled the page to it: the header lights up for a moment */
  isHighlighted?: boolean;
  testID?: string;
  children: React.ReactNode;
};

const FOLD_VALUE = 'open';

/**
 * One card in a fold. Whether it fades in is settled when it mounts: a view
 * on screen can't take on motion props later (Tamagui changes its hooks)
 */
function FoldRow({
  index,
  isAnimated,
  children,
}: {
  index: number;
  isAnimated: boolean;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [motion] = useState(() =>
    isAnimated ? getListRowMotion(index, reduceMotion) : undefined,
  );
  return <YStack {...motion}>{children}</YStack>;
}

/**
 * A group's cards folding in place, as the DeFi home's lists do: open over
 * 250 ms and shut over 200 ms on the smooth curve. Once the user has folded
 * the group, the cards that come back fade in, each a moment after the one
 * above; the ones on screen when the page opens don't.
 */
function GroupFold({
  expanded,
  hasToggled,
  children,
  ...frameProps
}: {
  expanded: boolean;
  hasToggled: boolean;
  children: React.ReactNode;
} & IYStackProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Accordion type="single" collapsible value={expanded ? FOLD_VALUE : ''}>
      <Accordion.Item value={FOLD_VALUE}>
        <Accordion.HeightAnimator
          transition={getListHeightTransition(expanded, reduceMotion)}
        >
          <Accordion.Content
            unstyled
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
            exitStyle={LIST_HIDDEN_STYLE}
          >
            <YStack {...frameProps}>
              {Children.toArray(children).map((child, index) => (
                <FoldRow
                  key={isValidElement(child) && child.key ? child.key : index}
                  index={index}
                  isAnimated={hasToggled}
                >
                  {child}
                </FoldRow>
              ))}
            </YStack>
          </Accordion.Content>
        </Accordion.HeightAnimator>
      </Accordion.Item>
    </Accordion>
  );
}

/** The chevron turns with the fold instead of flipping */
function FoldChevron({
  expanded,
  name,
  color,
}: {
  expanded: boolean;
  name: 'ChevronDownSmallSolid' | 'ChevronDownSmallOutline';
  color: '$icon' | '$iconSubdued';
}) {
  const reduceMotion = useReducedMotion();
  return (
    <View
      transition={reduceMotion ? undefined : 'quick'}
      rotate={expanded ? '180deg' : '0deg'}
      transformOrigin="center"
    >
      {/* the rows' chevron slot: the group's figure and theirs share one edge */}
      <Icon name={name} color={color} size="$5" />
    </View>
  );
}

function useFoldToggle(onToggle: () => void) {
  const [hasToggled, setHasToggled] = useState(false);
  const toggle = useCallback(() => {
    setHasToggled(true);
    onToggle();
  }, [onToggle]);
  return { hasToggled, toggle };
}

// The wallet token list's network badge (TokenNameView). Short of room it
// gives up its width well before the name does
function NetworkNameBadge({ name }: { name: string }) {
  return (
    <Badge flexShrink={100} minWidth={0}>
      <Badge.Text numberOfLines={1}>{name}</Badge.Text>
    </Badge>
  );
}

/**
 * The wide layout's group: the wallet DeFi Portfolio's desktop protocol card
 * (ProtocolDesktopLayout), a hairline-bordered card whose header row carries
 * the logo, name, count, figure and chevron on the subdued surface, the
 * group's content below it while open.
 */
function GroupCard({
  name,
  logoURI,
  networkId,
  networkName,
  total,
  subtitle,
  pendingCount = 0,
  expanded,
  onToggle,
  anchorRef,
  isHighlighted = false,
  testID,
  children,
}: IGroupRowProps) {
  // The header keeps its surface on hover, as the wallet's card header does;
  // the chevron answers instead
  const [isHovered, setIsHovered] = useState(false);
  const reduceMotion = useReducedMotion();
  const { hasToggled, toggle } = useFoldToggle(onToggle);
  return (
    <YStack
      ref={(node) => anchorRef?.(node as unknown as HTMLElement | null)}
      mx="$5"
      borderRadius="$3"
      borderCurve="continuous"
      overflow="hidden"
      bg="$bgApp"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$border"
      $theme-dark={{ borderColor: '$borderSubdued' }}
    >
      <XStack
        ai="center"
        gap="$3"
        px="$5"
        py="$3"
        bg={isHighlighted ? '$gray3' : '$bgSubdued'}
        transition={reduceMotion ? undefined : 'quick'}
        animateOnly={ANIMATE_ONLY_BG_COLOR}
        cursor="pointer"
        userSelect="none"
        role="button"
        aria-expanded={expanded}
        onPress={toggle}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        testID={testID}
        // Inside the card's clipped corners, so the ring sits inside too
        {...buildKeyboardPressProps(toggle, -2)}
      >
        <XStack ai="center" gap="$3" flex={1} minWidth={0}>
          <Token
            size="md"
            tokenImageUri={logoURI}
            showNetworkIcon={Boolean(networkId)}
            networkId={networkId}
          />
          <YStack flex={1} minWidth={0}>
            <XStack ai="center" gap="$2" minWidth={0}>
              <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
                {name}
              </SizableText>
              {networkName ? <NetworkNameBadge name={networkName} /> : null}
              {pendingCount > 0 ? (
                <PendingIndicator num={pendingCount} />
              ) : null}
            </XStack>
            {subtitle ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
              >
                {subtitle}
              </SizableText>
            ) : null}
          </YStack>
        </XStack>
        <XStack ai="center" gap="$1" flexShrink={0}>
          {total}
          <FoldChevron
            expanded={expanded}
            name="ChevronDownSmallSolid"
            color={isHovered ? '$icon' : '$iconSubdued'}
          />
        </XStack>
      </XStack>
      <GroupFold
        expanded={expanded}
        hasToggled={hasToggled}
        px="$5"
        pt="$3"
        pb="$4"
        gap="$4"
      >
        {children}
      </GroupFold>
    </YStack>
  );
}

/**
 * A collapsible group on either tab (figma 29180-108096 / 29180-109152):
 * logo, name, the group's figure and a chevron on one row, the group's
 * cards below it while open. Both the protocol groups and the ledger groups
 * render through this so the two tabs read the same; the wide layout draws
 * the same group as a card.
 */
export function GroupRow(props: IGroupRowProps) {
  const isTableLayout = usePortfolioTableLayout();
  const {
    name,
    logoURI,
    networkId,
    networkName,
    total,
    pendingCount = 0,
    expanded,
    onToggle,
    testID,
    children,
  } = props;
  const { hasToggled, toggle } = useFoldToggle(onToggle);
  if (isTableLayout) {
    return <GroupCard {...props} />;
  }
  return (
    <YStack>
      <XStack
        ai="center"
        jc="space-between"
        gap="$3"
        minHeight={44}
        px="$5"
        cursor="pointer"
        userSelect="none"
        role="button"
        aria-expanded={expanded}
        onPress={toggle}
        testID={testID}
        {...buildKeyboardPressProps(toggle, -2)}
      >
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
          <Token
            size="sm"
            borderRadius="$2"
            tokenImageUri={logoURI}
            showNetworkIcon={Boolean(networkId)}
            networkId={networkId}
          />
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {name}
          </SizableText>
          {networkName ? <NetworkNameBadge name={networkName} /> : null}
          {pendingCount > 0 ? <PendingIndicator num={pendingCount} /> : null}
        </XStack>
        <XStack ai="center" gap="$1" flexShrink={0}>
          {total}
          <FoldChevron
            expanded={expanded}
            name="ChevronDownSmallOutline"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
      {/* The header's gap moves into the fold, so a shut group adds none */}
      <GroupFold
        expanded={expanded}
        hasToggled={hasToggled}
        px="$5"
        pt="$3"
        gap="$3"
      >
        {children}
      </GroupFold>
    </YStack>
  );
}
