import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  View,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountSelectorRouteParamsExtraConfig } from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';
import { AccountAvatar } from '../../AccountAvatar';
import { SpotlightView } from '../../Spotlight';
import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerBase({
  num,
  autoWidthForHome,
  spotlightProps,
  ...others
}: {
  num: number;
  autoWidthForHome?: boolean;
  spotlightProps?: ISpotlightViewProps;
} & IAccountSelectorRouteParamsExtraConfig) {
  const {
    activeAccount: { account, dbAccount, indexedAccount, accountName, wallet },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, ...others });
  const intl = useIntl();
  const media = useMedia();

  const maxWidth = useMemo(() => {
    if (autoWidthForHome) {
      if (media.gtLg) {
        return '$80';
      }
      if (media.sm) {
        return '$60';
      }
      if (media.md) {
        return '$48';
      }
    }
    return '$48';
  }, [autoWidthForHome, media.gtLg, media.md, media.sm]);

  const content = useMemo(
    () => (
      <XStack
        testID="AccountSelectorTriggerBase"
        role="button"
        alignItems="center"
        maxWidth={maxWidth}
        width="$full"
        // width="$80"
        // flex={1}
        py="$0.5"
        px="$1.5"
        mx="$-1.5"
        borderRadius="$2"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        onPress={showAccountSelector}
        userSelect="none"
      >
        <AccountAvatar
          size="small"
          borderRadius="$1"
          indexedAccount={indexedAccount}
          account={account}
          dbAccount={dbAccount}
        />
        <View
          pl="$2"
          pr="$1"
          minWidth={0}
          flexShrink={1}
          flex={platformEnv.isNative ? undefined : 1}
        >
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
            flexShrink={0}
          >
            {wallet?.name ||
              intl.formatMessage({ id: ETranslations.global_no_wallet })}
          </SizableText>
          <SizableText
            size="$bodyMdMedium"
            numberOfLines={1}
            flexShrink={0}
            testID="account-name"
          >
            {accountName ||
              intl.formatMessage({ id: ETranslations.no_account })}
          </SizableText>
        </View>
        <Icon
          flexShrink={0} // Prevents the icon from shrinking when the text is too long
          name="ChevronGrabberVerOutline"
          size="$5"
          color="$iconSubdued"
        />
      </XStack>
    ),
    [
      account,
      accountName,
      dbAccount,
      indexedAccount,
      intl,
      maxWidth,
      showAccountSelector,
      wallet?.name,
    ],
  );

  useShortcutsOnRouteFocused(
    EShortcutEvents.AccountSelector,
    showAccountSelector,
  );

  return spotlightProps ? (
    <SpotlightView {...spotlightProps}>{content}</SpotlightView>
  ) : (
    content
  );
}
