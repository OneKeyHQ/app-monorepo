import { memo } from 'react';

import { useIntl } from 'react-intl';

import { XStack } from '@onekeyhq/components';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

function SignatureConfirmAccountInfo({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const { account, network } = useAccountData({ accountId, networkId });

  return (
    <SignatureConfirmItem gap="$5">
      <SignatureConfirmItem>
        <SignatureConfirmItem.Label>
          {intl.formatMessage({ id: ETranslations.network__network })}
        </SignatureConfirmItem.Label>
        <XStack gap="$2">
          <NetworkAvatar size="$5" networkId={networkId} />
          <SignatureConfirmItem.Value>
            {network?.name}
          </SignatureConfirmItem.Value>
        </XStack>
      </SignatureConfirmItem>
      <SignatureConfirmItem>
        <SignatureConfirmItem.Label>
          {intl.formatMessage({ id: ETranslations.copy_address_modal_title })}
        </SignatureConfirmItem.Label>
        <SignatureConfirmItem.Value>
          {account?.address}
        </SignatureConfirmItem.Value>
        {account?.address ? (
          <AddressInfo
            accountId={accountId}
            networkId={networkId}
            address={account?.address}
          />
        ) : null}
      </SignatureConfirmItem>
    </SignatureConfirmItem>
  );
}

export default memo(SignatureConfirmAccountInfo);
