import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { ListItem } from '../ListItem';

import AddressTypeCheckMark from './AddressTypeCheckMark';
import AddressTypeFiat from './AddressTypeFiat';
import { useAddressTypeSelectorDynamicContext } from './AddressTypeSelectorContext';

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
