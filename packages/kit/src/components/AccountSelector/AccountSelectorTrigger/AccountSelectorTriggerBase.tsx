import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Button,
  DebugRenderTracker,
  Icon,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';
import { useAccountSelectorSceneInfo } from '../../../states/jotai/contexts/accountSelector';
import { AccountAvatar } from '../../AccountAvatar';
import { SpotlightView } from '../../Spotlight';
import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';
import { AccountSelectorTestIDs } from '../testIDs';

import type { ISpotlightViewProps } from '../../Spotlight';

// Desktop wallet header: the account, network and copy triggers share one
// hover shape (32 high, radius 8, 6 in from the content and 2 on the chevron
// side), reach 40 high for the pointer without widening into each other, and
// work from the keyboard (on web `focusable` alone adds no tab stop).
export const DESKTOP_HEADER_TRIGGER_SHAPE: IXStackProps = {
  py: '$1',
  pl: '$1.5',
  pr: '$0.5',
  my: '$-1',
  ml: '$-1.5',
  mr: '$-0.5',
  borderRadius: '$2',
};
export const DESKTOP_HEADER_TRIGGER_PROPS: IXStackProps = {
  ...DESKTOP_HEADER_TRIGGER_SHAPE,
  role: 'button',
  tabIndex: 0,
  focusVisibleStyle: {
    outlineWidth: 2,
    outlineColor: '$focusRing',
    outlineStyle: 'solid',
  },
};

// A 44 target around the 34 high medium tertiary button.
const TERTIARY_TRIGGER_HIT_SLOP = { top: 5, bottom: 5 };
// The chevron sits right after the name and the fill ends 2 past it, so the
// fill hangs 9 past the label on the left and 3 on the right.
const TERTIARY_TRIGGER_CHEVRON_PROPS = { ml: '$0' } as const;

export function DesktopHeaderHitArea() {
  return <Stack position="absolute" top={-4} bottom={-4} left={0} right={0} />;
}

export function handleDesktopHeaderKeyDown(
  event: { key: string; preventDefault: () => void },
  onPress: () => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onPress();
  }
}

export function AccountSelectorTriggerBase({
  num,
  spotlightProps,
  horizontalLayout,
  showWalletAvatar,
  showWalletName = true,
  showConnectWalletModalInDappMode,
  disabled,
  linkNetworkId,
  linkNetwork,
  containerProps,
  alignChevronToEnd,
  desktopHeader,
  tertiaryButton,
  ...others
}: {
  num: number;
  autoWidthForHome?: boolean;
  spotlightProps?: ISpotlightViewProps;
  horizontalLayout?: boolean;
  showWalletAvatar?: boolean;
  showWalletName?: boolean;
  showConnectWalletModalInDappMode?: boolean;
  disabled?: boolean;
  containerProps?: IXStackProps;
  // Full-width form-field triggers pin the chevron to the row end; adaptive
  // header triggers keep it right after the label (native default).
  alignChevronToEnd?: boolean;
  desktopHeader?: boolean;
  // The phone wallet home names the account above the balance with a plain
  // tertiary button: the name and a chevron, no avatar.
  tertiaryButton?: boolean;
} & IAccountSelectorRouteParamsExtraConfig) {
  const { sceneName } = useAccountSelectorSceneInfo();
  const {
    activeAccount: { account, dbAccount, indexedAccount, accountName, wallet },
    showAccountSelector,
  } = useAccountSelectorTrigger({
    num,
    showConnectWalletModalInDappMode,
    linkNetworkId,
    linkNetwork: linkNetwork || !!linkNetworkId,
    ...others,
  });
  const intl = useIntl();
  const walletName =
    wallet?.name || intl.formatMessage({ id: ETranslations.global_no_wallet });
  const displayAccountName =
    accountName || intl.formatMessage({ id: ETranslations.no_account });

  const isWebDappModeWithNoWallet =
    platformEnv.isWebDappMode && !wallet && !accountName;
  const isWebDappAccountLocked = Boolean(
    platformEnv.isWebDappMode &&
    sceneName === EAccountSelectorSceneName.homeUrlAccount &&
    !isWebDappModeWithNoWallet,
  );
  const isTriggerDisabled = Boolean(disabled || isWebDappAccountLocked);
  const displayLabel =
    isWebDappAccountLocked && account?.address
      ? accountUtils.shortenAddress({ address: account.address })
      : displayAccountName;

  const handleAccountSelectorPress = useCallback(() => {
    if (isTriggerDisabled) {
      return;
    }
    showAccountSelector();
  }, [isTriggerDisabled, showAccountSelector]);

  const contentView = useMemo(() => {
    if (isWebDappModeWithNoWallet) {
      return (
        <Button
          testID={AccountSelectorTestIDs.trigger}
          size="small"
          variant="primary"
          h="$8"
          shadowOpacity={0}
          elevation={0}
          disabled={isTriggerDisabled}
          hoverStyle={{
            opacity: 0.9,
          }}
          pressStyle={{
            opacity: 0.8,
          }}
          onPress={handleAccountSelectorPress}
        >
          {intl.formatMessage({ id: ETranslations.global_connect })}
        </Button>
      );
    }

    if (tertiaryButton) {
      // The fill's overhang (9 left, 3 right) sits on this box, not on the
      // button: in a box sized to its content, a button carrying those margins
      // gets a 100% max width 12 short of itself, and its centered name slips
      // 6 to the left.
      return (
        <Stack ml={-9} mr={-3}>
          <Button
            testID={AccountSelectorTestIDs.trigger}
            variant="tertiary"
            iconAfter={
              isTriggerDisabled ? undefined : 'ChevronDownSmallOutline'
            }
            iconAfterProps={TERTIARY_TRIGGER_CHEVRON_PROPS}
            disabled={isTriggerDisabled}
            textEllipsis
            alignSelf="flex-start"
            maxWidth="100%"
            mx={0}
            pr="$0.5"
            hitSlop={TERTIARY_TRIGGER_HIT_SLOP}
            onPress={handleAccountSelectorPress}
          >
            {displayLabel}
          </Button>
        </Stack>
      );
    }

    return (
      <XStack
        testID={AccountSelectorTestIDs.trigger}
        role={isTriggerDisabled ? undefined : 'button'}
        alignItems="center"
        width="$full"
        // width="$80"
        // flex={1}
        py="$1"
        px="$1.5"
        mx="$-1.5"
        borderRadius="$2"
        hoverStyle={isTriggerDisabled ? undefined : { bg: '$bgHover' }}
        pressStyle={isTriggerDisabled ? undefined : { bg: '$bgActive' }}
        focusable={!isTriggerDisabled}
        focusVisibleStyle={
          isTriggerDisabled
            ? undefined
            : {
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }
        }
        onPress={handleAccountSelectorPress}
        userSelect="none"
        {...(desktopHeader &&
          !isTriggerDisabled && {
            ...DESKTOP_HEADER_TRIGGER_PROPS,
            onKeyDown: (event: { key: string; preventDefault: () => void }) =>
              handleDesktopHeaderKeyDown(event, handleAccountSelectorPress),
          })}
        {...containerProps}
      >
        {desktopHeader && !isTriggerDisabled ? <DesktopHeaderHitArea /> : null}
        <AccountAvatar
          size="small"
          borderRadius="$1"
          indexedAccount={indexedAccount}
          account={account}
          dbAccount={dbAccount}
          wallet={showWalletAvatar ? wallet : undefined}
          compactWalletBadge={desktopHeader}
        />
        <Stack
          flexDirection={horizontalLayout ? 'row' : 'column'}
          pl={showWalletAvatar ? '$2.5' : '$2'}
          flexShrink={1}
          flex={alignChevronToEnd || !platformEnv.isNative ? 1 : undefined}
        >
          {horizontalLayout ? (
            <SizableText
              size={showWalletName ? '$bodyMdMedium' : '$bodyLgMedium'}
              $gtMd={{
                size: '$bodyMdMedium',
              }}
              color="$text"
              $gtXl={{
                maxWidth: '$56',
              }}
              numberOfLines={1}
              flexShrink={1}
              maxWidth="$40"
              testID={AccountSelectorTestIDs.triggerAccountName}
            >
              {showWalletName
                ? `${walletName} / ${displayLabel}`
                : displayLabel}
            </SizableText>
          ) : (
            <>
              <SizableText
                size="$bodyMd"
                color="$text"
                numberOfLines={horizontalLayout ? undefined : 1}
                flexShrink={1}
              >
                {walletName}
              </SizableText>
              <SizableText
                size="$bodyMd"
                numberOfLines={horizontalLayout ? undefined : 1}
                flexShrink={1}
                testID={AccountSelectorTestIDs.triggerAccountName}
              >
                {displayLabel}
              </SizableText>
            </>
          )}
        </Stack>
        {isTriggerDisabled ? null : (
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        )}
      </XStack>
    );
  }, [
    account,
    alignChevronToEnd,
    containerProps,
    dbAccount,
    desktopHeader,
    displayLabel,
    handleAccountSelectorPress,
    horizontalLayout,
    indexedAccount,
    isWebDappModeWithNoWallet,
    isTriggerDisabled,
    showWalletAvatar,
    showWalletName,
    tertiaryButton,
    wallet,
    walletName,
    intl,
  ]);

  const content = (
    <DebugRenderTracker
      name="AccountSelectorTriggerBase"
      position="bottom-center"
    >
      {contentView}
    </DebugRenderTracker>
  );

  useShortcutsOnRouteFocused(
    EShortcutEvents.AccountSelector,
    handleAccountSelectorPress,
  );

  return spotlightProps ? (
    <SpotlightView {...spotlightProps}>{content}</SpotlightView>
  ) : (
    content
  );
}
