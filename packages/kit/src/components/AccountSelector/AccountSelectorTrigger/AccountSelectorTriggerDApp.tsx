import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Skeleton,
  Tooltip,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';
import { useAccountSelectorSyncLoadingAtom } from '../../../states/jotai/contexts/accountSelector';
import {
  useAccountSelectorTrigger,
  useMockAccountSelectorLoading,
} from '../hooks/useAccountSelectorTrigger';

const InterAccountAvatar = ({
  isLoading,
  account,
  indexedAccount,
}: {
  isLoading?: boolean;
  account?: INetworkAccount;
  indexedAccount?: IDBIndexedAccount;
}) => {
  if (isLoading) {
    return <Skeleton w="$8" h="$8" />;
  }
  if (account?.address || account?.addressDetail.isValid) {
    return (
      <AccountAvatar
        size="$8"
        borderRadius="$2"
        account={account}
        indexedAccount={indexedAccount}
      />
    );
  }
  return <Icon size="$8" name="XSquareOutline" color="$iconSubdued" />;
};

const InterWalletAndAccountName = ({
  isLoading,
  accountName,
  walletName,
}: {
  isLoading?: boolean;
  accountName: string;
  walletName: string;
}) => {
  if (isLoading) {
    return (
      <XStack alignItems="center" h="$5">
        <Skeleton w={118} h={14} />
      </XStack>
    );
  }
  return (
    <XStack>
      <XStack maxWidth="$40">
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {walletName}
        </SizableText>
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        /
      </SizableText>
      <XStack maxWidth="$40">
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {accountName}
        </SizableText>
      </XStack>
    </XStack>
  );
};

const InterAddressText = ({
  isLoading,
  addressText,
}: {
  isLoading?: boolean;
  addressText: string;
}) => {
  if (
    isLoading ||
    accountUtils.isAllNetworkMockAddress({ address: addressText })
  ) {
    return (
      <XStack alignItems="center" h="$5">
        <Skeleton w={196} h={14} />
      </XStack>
    );
  }
  return (
    <SizableText flex={1} size="$bodyMdMedium" numberOfLines={1} color="$text">
      {addressText}
    </SizableText>
  );
};

export const AccountSelectorTriggerDappConnectionCmp = ({
  isLoading,
  wallet,
  account,
  indexedAccount,
  triggerDisabled,
  handlePress,
  ...rest
}: {
  wallet?: IDBWallet;
  account?: INetworkAccount;
  indexedAccount?: IDBIndexedAccount;
  isLoading?: boolean;
  triggerDisabled?: boolean;
  handlePress?: () => void;
} & ComponentProps<typeof XStack>) => {
  const intl = useIntl();
  const accountName = account?.name
    ? account.name
    : intl.formatMessage({ id: ETranslations.no_account });
  const walletName = wallet?.name
    ? wallet.name
    : intl.formatMessage({ id: ETranslations.global_no_wallet });

  let addressText = '';
  if (account?.address) {
    addressText = accountUtils.shortenAddress({
      address: account.address || '',
    });
  } else if (!account?.address && account?.addressDetail.isValid) {
    addressText = '';
  } else {
    addressText = intl.formatMessage({ id: ETranslations.wallet_no_address });
  }

  return (
    <XStack
      flex={1}
      py="$2"
      px="$3"
      gap="$2"
      bg="$bgApp"
      alignItems="center"
      userSelect="none"
      hoverStyle={
        triggerDisabled
          ? undefined
          : {
              bg: '$bgHover',
            }
      }
      pressStyle={
        triggerDisabled
          ? undefined
          : {
              bg: '$bgActive',
            }
      }
      focusable={!triggerDisabled}
      focusVisibleStyle={
        triggerDisabled
          ? undefined
          : {
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }
      }
      borderCurve="continuous"
      onPress={handlePress}
      disabled={triggerDisabled}
      {...rest}
    >
      <InterAccountAvatar
        isLoading={isLoading}
        account={account}
        indexedAccount={indexedAccount}
      />
      <YStack flex={1}>
        <InterWalletAndAccountName
          isLoading={isLoading}
          walletName={walletName}
          accountName={accountName}
        />
        <InterAddressText isLoading={isLoading} addressText={addressText} />
      </YStack>
      {triggerDisabled ? null : (
        <Icon name="ChevronGrabberVerOutline" color="$iconSubdued" size="$5" />
      )}
    </XStack>
  );
};

export const AccountSelectorTriggerDappConnection = XStack.styleable<{
  num: number;
  compressionUiMode?: boolean;
  beforeShowTrigger?: () => Promise<void>;
  loadingDuration?: number;
}>(
  (
    {
      num,
      compressionUiMode,
      disabled,
      beforeShowTrigger,
      loadingDuration,
      ...rest
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _: any,
  ) => {
    const { isLoading: mockIsLoading } =
      useMockAccountSelectorLoading(loadingDuration);
    const [syncLoading] = useAccountSelectorSyncLoadingAtom();
    const isLoading = syncLoading?.[num]?.isLoading || mockIsLoading;

    const {
      activeAccount: { account, wallet, indexedAccount },
      showAccountSelector,
    } = useAccountSelectorTrigger({ num, linkNetwork: true });

    const triggerDisabled = isLoading || disabled;

    const handlePress = useCallback(async () => {
      await beforeShowTrigger?.();
      showAccountSelector();
    }, [beforeShowTrigger, showAccountSelector]);

    useEffect(() => {
      console.log('AccountSelectorTriggerDappConnection', ':renderer=====>');
    }, []);

    return (
      <AccountSelectorTriggerDappConnectionCmp
        account={account}
        wallet={wallet}
        indexedAccount={indexedAccount}
        isLoading={isLoading}
        triggerDisabled={triggerDisabled}
        handlePress={handlePress}
        {...rest}
      />
    );
  },
);

export function AccountSelectorTriggerBrowserSingle({ num }: { num: number }) {
  const {
    activeAccount: { account, indexedAccount, wallet },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, linkNetwork: true });

  const media = useMedia();
  const intl = useIntl();

  const handlePress = useCallback(async () => {
    showAccountSelector();
  }, [showAccountSelector]);

  const accountName = account?.name
    ? account.name
    : intl.formatMessage({
        id: ETranslations.wallet_no_address,
      });

  useShortcutsOnRouteFocused(EShortcutEvents.AccountSelector, handlePress);

  const trigger = useMemo(
    () => (
      <XStack
        role="button"
        p="$1.5"
        borderRadius="$2"
        alignItems="center"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusable
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
        }}
        onPress={handlePress}
        maxWidth="$40"
        minWidth={0}
      >
        <AccountAvatar
          size="small"
          account={account}
          indexedAccount={indexedAccount}
        />
        {media.gtMd ? (
          <>
            <View pl="$2" pr="$1" minWidth={0} maxWidth="$24">
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {wallet?.name}
              </SizableText>
              <SizableText size="$bodyMdMedium" numberOfLines={1}>
                {accountName}
              </SizableText>
            </View>
            <Icon
              name="ChevronDownSmallOutline"
              color="$iconSubdued"
              size="$5"
            />
          </>
        ) : null}
      </XStack>
    ),
    [
      account,
      accountName,
      handlePress,
      indexedAccount,
      media.gtMd,
      wallet?.name,
    ],
  );
  return (
    <Tooltip
      shortcutKey={EShortcutEvents.AccountSelector}
      renderTrigger={trigger}
      renderContent={intl.formatMessage({ id: ETranslations.global_account })}
      placement="bottom"
    />
  );
}

export function AccountSelectorTriggerAddressSingle({ num }: { num: number }) {
  const intl = useIntl();
  const {
    activeAccount: { account, network },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num, linkNetwork: true });

  const handlePress = useCallback(async () => {
    showAccountSelector();
  }, [showAccountSelector]);

  const [showNoAddress, setShowNoAddress] = useState(false);

  let addressText = '';
  if (
    accountUtils.isAllNetworkMockAddress({ address: account?.address || '' })
  ) {
    addressText = '';
  } else if (!account?.address && account?.addressDetail.isValid) {
    addressText = account?.name || '';
  } else {
    addressText = accountUtils.shortenAddress({
      address: account?.address || '',
    });
  }

  useEffect(() => {
    if (!addressText) {
      const timer = setTimeout(() => {
        setShowNoAddress(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [addressText]);

  if (!addressText && !showNoAddress) {
    return <Skeleton width={153} height="$5" />;
  }

  return (
    <XStack
      alignItems="center"
      pl="$1"
      ml="$-1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      onPress={(event) => {
        event.stopPropagation();
        void handlePress();
      }}
      userSelect="none"
    >
      <NetworkAvatarBase
        logoURI={network?.logoURI ?? ''}
        isCustomNetwork={network?.isCustomNetwork}
        networkName={network?.name}
        size="$4"
      />
      <SizableText
        pl="$1.5"
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={1}
      >
        {addressText ||
          (showNoAddress
            ? intl.formatMessage({
                id: ETranslations.wallet_no_address,
              })
            : '')}
      </SizableText>
      <Icon size="$5" color="$iconSubdued" name="ChevronDownSmallOutline" />
    </XStack>
  );
}
