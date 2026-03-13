import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

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

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerBase({
  num,
  spotlightProps,
  horizontalLayout,
  showWalletAvatar,
  showWalletName = true,
  showConnectWalletModalInDappMode,
  linkNetworkId,
  linkNetwork,
  ...others
}: {
  num: number;
  autoWidthForHome?: boolean;
  spotlightProps?: ISpotlightViewProps;
  horizontalLayout?: boolean;
  showWalletAvatar?: boolean;
  showWalletName?: boolean;
  showConnectWalletModalInDappMode?: boolean;
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
  const isTriggerDisabled =
    platformEnv.isWebDappMode &&
    sceneName === EAccountSelectorSceneName.homeUrlAccount &&
    !isWebDappModeWithNoWallet;
  const displayLabel =
    isTriggerDisabled && account?.address
      ? accountUtils.shortenAddress({ address: account.address })
      : displayAccountName;

  const handleAccountSelectorPress = useCallback(() => {
    if (isTriggerDisabled) {
      return;
    }
    showAccountSelector();
  }, [isTriggerDisabled, showAccountSelector]);

  const contentView = useMemo(
    () => (
      <XStack
        testID="AccountSelectorTriggerBase"
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
      >
        {isWebDappModeWithNoWallet ? (
          <Button
            size="small"
            variant="primary"
            h="$8"
            shadowOpacity={0}
            elevation={0}
            hoverStyle={{
              opacity: 0.9,
            }}
            pressStyle={{
              opacity: 0.8,
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_connect })}
          </Button>
        ) : (
          <>
            <AccountAvatar
              size="small"
              borderRadius="$1"
              indexedAccount={indexedAccount}
              account={account}
              dbAccount={dbAccount}
              wallet={showWalletAvatar ? wallet : undefined}
            />
            <Stack
              flexDirection={horizontalLayout ? 'row' : 'column'}
              pl={showWalletAvatar ? '$2.5' : '$2'}
              flexShrink={1}
              flex={platformEnv.isNative ? undefined : 1}
            >
              {horizontalLayout ? (
                <SizableText
                  size={showWalletName ? '$bodyMdMedium' : '$bodyLgMedium'}
                  $gtMd={{
                    size: '$bodyMdMedium',
                  }}
                  color="$text"
                  $gtXl={{
                    maxWidth: '56',
                  }}
                  numberOfLines={1}
                  flexShrink={1}
                  maxWidth="$36"
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
                    testID="account-name"
                  >
                    {displayLabel}
                  </SizableText>
                </>
              )}
            </Stack>
            {isTriggerDisabled ? null : (
              <Icon
                name="ChevronDownSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            )}
          </>
        )}
      </XStack>
    ),
    [
      account,
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
    ],
  );

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
