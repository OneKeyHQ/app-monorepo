import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  Popover,
  SizableText,
  Tooltip,
  YStack,
} from '@onekeyhq/components';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { ListItem } from '../ListItem';

import AddressTypeCheckMark from './AddressTypeCheckMark';
import AddressTypeFiat from './AddressTypeFiat';
import {
  useAddressTypeSelectorDynamicContext,
  useAddressTypeSelectorStableContext,
} from './AddressTypeSelectorContext';

const addressTypeTooltipMap: Partial<Record<EAddressEncodings, ETranslations>> =
  {
    [EAddressEncodings.P2TR]: ETranslations.address_type_tooltip_taproot__desc,
    [EAddressEncodings.P2WPKH]:
      ETranslations.address_type_tooltip_native_segwit__desc,
    [EAddressEncodings.P2SH_P2WPKH]:
      ETranslations.address_type_tooltip_nested_segwit__desc,
    [EAddressEncodings.P2PKH]: ETranslations.address_type_tooltip_legacy__desc,
  };

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
  const { isCreatingAddress } = useAddressTypeSelectorDynamicContext();
  const { networkId } = useAddressTypeSelectorStableContext();

  const isBTC = networkUtils.isBTCNetwork(networkId);

  const tooltipI18nKey =
    isBTC && deriveInfo.addressEncoding
      ? addressTypeTooltipMap[deriveInfo.addressEncoding]
      : undefined;

  const tooltipText = tooltipI18nKey
    ? intl.formatMessage({ id: tooltipI18nKey })
    : undefined;

  const titleText = deriveInfo.labelKey
    ? intl.formatMessage({ id: deriveInfo.labelKey })
    : deriveInfo.label;

  const subtitleText = account
    ? accountUtils.shortenAddress({
        address: account.addressDetail.displayAddress,
      })
    : intl.formatMessage({ id: ETranslations.global_create_address });

  const titleElement = useMemo(() => {
    if (!tooltipText) {
      return (
        <SizableText
          size="$bodyMdMedium"
          $gtMd={{ size: '$bodySmMedium' }}
          pb="$0.5"
        >
          {titleText}
        </SizableText>
      );
    }

    const dashTrigger = (
      <DashText
        size="$bodyMdMedium"
        $gtMd={{ size: '$bodySmMedium' }}
        dashColor="$textDisabled"
        dashThickness={0.5}
        cursor="help"
      >
        {titleText ?? ''}
      </DashText>
    );

    if (platformEnv.isNative) {
      return (
        <YStack alignSelf="flex-start">
          <Popover
            title=""
            showHeader={false}
            placement="top"
            renderTrigger={dashTrigger}
            renderContent={
              <YStack p="$5">
                <SizableText size="$bodyMd">{tooltipText}</SizableText>
              </YStack>
            }
          />
        </YStack>
      );
    }

    return (
      <YStack alignSelf="flex-start">
        <Tooltip
          placement="top"
          renderTrigger={dashTrigger}
          renderContent={tooltipText}
        />
      </YStack>
    );
  }, [titleText, tooltipText]);

  const renderItemText = useMemo(
    () => (
      <YStack flex={1} userSelect="none" pb="$0.5">
        {titleElement}
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          $gtMd={{ size: '$bodySm' }}
        >
          {subtitleText}
        </SizableText>
      </YStack>
    ),
    [titleElement, subtitleText],
  );

  return (
    <ListItem
      disabled={isCreatingAddress}
      alignItems="flex-start"
      borderRadius="$2"
      mx="$0"
      px="$2"
      py="$1"
      renderItemText={renderItemText}
      childrenBefore={
        <AddressTypeCheckMark accountId={account?.id} deriveType={deriveType} />
      }
      onPress={() => {
        void onSelect?.({
          account,
          deriveInfo,
          deriveType,
        });
      }}
    >
      <AddressTypeFiat
        accountId={account?.id}
        xpub={(account as IDBUtxoAccount)?.xpub}
      />
    </ListItem>
  );
}

export default memo(AddressTypeSelectorItem);
