import type { IStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/components/src/actions/AccountAvatar';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAccountSelectorTrigger } from '../hooks/useAccountSelectorTrigger';

// static ui, can render without account selector provider
export const AccountSelectorTriggerDAppComponent = XStack.styleable<{
  account?: IDBAccount;
  accountName: string;
  onPress?: () => void;
}>(({ account, accountName, onPress, disabled, ...style }) => {
  const addressText = account?.address
    ? accountUtils.shortenAddress({
        address: account.address || '',
      })
    : 'No Address';

  const media = useMedia();
  return (
    <XStack
      flex={1}
      py="$2"
      px="$3"
      space="$2"
      bg="$bgApp"
      alignItems="center"
      hoverStyle={{
        bg: '$bgHover',
      }}
      {...style}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable={!disabled}
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      onPress={onPress}
    >
      {account?.address ? (
        <AccountAvatar size="$6" borderRadius="$1" account={account} />
      ) : null}
      {media.md ? (
        <YStack flex={1}>
          <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
            {accountName}
          </SizableText>
          <SizableText size="$bodyMdMedium" numberOfLines={1} color="$text">
            {addressText}
          </SizableText>
        </YStack>
      ) : (
        <SizableText size="$bodyMd" numberOfLines={1} color="$textSubdued">
          {accountName}
        </SizableText>
      )}
      {media.md ? null : (
        <SizableText
          flex={1}
          size="$bodyMdMedium"
          numberOfLines={1}
          color="$text"
        >
          {addressText}
        </SizableText>
      )}
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
});

export const AccountSelectorTriggerDappConnection = ({
  num,
  style,
}: {
  num: number;
  style?: IStackProps;
}) => {
  console.log('===>>:rest: ', style);
  const {
    activeAccount: { account },
    activeAccountName,
    showAccountSelector,
  } = useAccountSelectorTrigger({ num });

  return (
    <AccountSelectorTriggerDAppComponent
      {...style}
      account={account}
      onPress={showAccountSelector}
      accountName={activeAccountName}
    />
  );
};
