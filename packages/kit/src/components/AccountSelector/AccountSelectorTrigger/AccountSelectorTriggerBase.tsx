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
  compact,
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
  compact?: boolean;
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
    const labelPadding = showWalletAvatar ? '$2.5' : '$2';
    const labelSize = showWalletName ? '$bodyMdMedium' : '$bodyLgMedium';
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

    return (
      <XStack
        testID={AccountSelectorTestIDs.trigger}
        role={isTriggerDisabled ? undefined : 'button'}
        alignItems="center"
        width={compact ? 'auto' : '$full'}
        maxWidth={compact ? '100%' : undefined}
        minHeight={compact ? '$7' : undefined}
        flexShrink={compact ? 1 : undefined}
        py="$1"
        px={compact ? '$2' : '$1.5'}
        mx={compact ? '$0' : '$-1.5'}
        bg={compact ? '$bgStrong' : undefined}
        borderRadius={compact ? '$full' : '$2'}
        hitSlop={compact ? { top: 8, bottom: 8, left: 0, right: 0 } : undefined}
        cursor={compact && !isTriggerDisabled ? 'pointer' : undefined}
        hoverStyle={
          isTriggerDisabled
            ? undefined
            : { bg: compact ? '$bgStrongHover' : '$bgHover' }
        }
        pressStyle={
          isTriggerDisabled
            ? undefined
            : { bg: compact ? '$bgStrongActive' : '$bgActive' }
        }
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
        {...containerProps}
      >
        <AccountAvatar
          size={compact ? '$4' : 'small'}
          borderRadius="$1"
          indexedAccount={indexedAccount}
          account={account}
          dbAccount={dbAccount}
          wallet={showWalletAvatar ? wallet : undefined}
        />
        <Stack
          flexDirection={horizontalLayout ? 'row' : 'column'}
          pl={compact ? '$1' : labelPadding}
          flexShrink={1}
          flex={
            alignChevronToEnd || (!compact && !platformEnv.isNative)
              ? 1
              : undefined
          }
        >
          {horizontalLayout ? (
            <SizableText
              size={compact ? '$bodySmMedium' : labelSize}
              $gtMd={{
                size: compact ? '$bodySmMedium' : '$bodyMdMedium',
              }}
              color="$text"
              $gtXl={{
                maxWidth: '56',
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
          <Icon
            name="ChevronDownSmallOutline"
            size={compact ? '$4' : '$5'}
            color="$iconSubdued"
          />
        )}
      </XStack>
    );
  }, [
    account,
    alignChevronToEnd,
    compact,
    containerProps,
    dbAccount,
    displayLabel,
    handleAccountSelectorPress,
    horizontalLayout,
    indexedAccount,
    isWebDappModeWithNoWallet,
    isTriggerDisabled,
    showWalletAvatar,
    showWalletName,
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
