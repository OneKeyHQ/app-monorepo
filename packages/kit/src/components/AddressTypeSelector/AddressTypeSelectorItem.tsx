import { memo, useMemo } from 'react';

import { find } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { ListItem } from '../ListItem';
import { NetworkAvatar } from '../NetworkAvatar';

import { useAddressTypeSelectorContext } from './AddressTypeSelectorContext';

type IProps = {
  data: {
    account: INetworkAccount | undefined;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
  };
  onSelect?: (value: {
    account: INetworkAccount | undefined;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
  }) => Promise<void>;
};

function AddressTypeSelectorItem(props: IProps) {
  const { data, onSelect } = props;
  const { deriveInfo, deriveType, account } = data;
  const intl = useIntl();
  const {
    tokenMap,
    activeDeriveType,
    networkId,
    isCreatingAddress,
    creatingDeriveType,
  } = useAddressTypeSelectorContext();

  const isCreatingCurrentDeriveType = useMemo(() => {
    return deriveType === creatingDeriveType && isCreatingAddress;
  }, [deriveType, creatingDeriveType, isCreatingAddress]);

  const [settings] = useSettingsPersistAtom();
  let tokenFiat: ITokenFiat | undefined;

  if (tokenMap) {
    tokenFiat = find(
      tokenMap,
      (_, key) =>
        !!(
          (data.account as IDBUtxoAccount)?.xpub &&
          key.includes((data.account as IDBUtxoAccount)?.xpub)
        ),
    );
  }

  return (
    <ListItem
      disabled={isCreatingAddress}
      alignItems="flex-start"
      borderRadius="$2"
      mx="$0"
      px="$2"
      py="$1"
      title={
        deriveInfo.labelKey
          ? intl.formatMessage({ id: deriveInfo.labelKey })
          : deriveInfo.label
      }
      titleProps={{
        size: '$bodyMdMedium',
        $gtMd: {
          size: '$bodySmMedium',
        },
        pb: '$0.5',
      }}
      subtitle={
        account
          ? accountUtils.shortenAddress({
              address: account.addressDetail.displayAddress,
            })
          : intl.formatMessage({ id: ETranslations.global_create_address })
      }
      subtitleProps={{
        size: '$bodyMd',
        $gtMd: {
          size: '$bodySm',
        },
      }}
      childrenBefore={
        <Stack
          w="$5"
          h="$5"
          $gtMd={{
            w: '$4',
            h: '$4',
          }}
          mr="$-1"
        >
          {!account && !isCreatingCurrentDeriveType ? (
            <Icon size="$4" name="PlusLargeOutline" color="$iconSubdued" />
          ) : null}
          {account && deriveType === activeDeriveType ? (
            <Icon size="$4" name="CheckmarkSolid" color="$iconActive" />
          ) : null}
          {isCreatingCurrentDeriveType ? <Spinner size="small" /> : null}
        </Stack>
      }
      onPress={() => {
        void onSelect?.({
          account,
          deriveInfo,
          deriveType,
        });
      }}
    >
      {tokenFiat ? (
        <YStack alignItems="flex-end" userSelect="none">
          <XStack alignItems="center" gap="$1" pb="$0.5">
            <NetworkAvatar networkId={networkId} size={16} />
            <NumberSizeableText
              size="$bodyMdMedium"
              $gtMd={{
                size: '$bodySmMedium',
              }}
              formatter="balance"
            >
              {tokenFiat.balanceParsed}
            </NumberSizeableText>
          </XStack>
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
            $gtMd={{
              size: '$bodySm',
            }}
          >
            {tokenFiat.fiatValue}
          </NumberSizeableText>
        </YStack>
      ) : null}
    </ListItem>
  );
}

export default memo(AddressTypeSelectorItem);
