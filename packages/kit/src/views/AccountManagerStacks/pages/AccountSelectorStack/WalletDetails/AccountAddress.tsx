import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function AccountAddress({
  num,
  address,
  linkedNetworkId,
  isEmptyAddress,
  hideAddress,
}: {
  num: number;
  address: string;
  linkedNetworkId?: string;
  isEmptyAddress: boolean;
  hideAddress?: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num });
  const intl = useIntl();
  // const noAddressMessage = intl.formatMessage(
  //   { id: ETranslations.global_no_network_address },
  //   {
  //     network:
  //       linkedNetworkId === activeAccount?.network?.id
  //         ? activeAccount?.network?.shortname || ''
  //         : '',
  //     //   network: '11',
  //   },
  // );
  const noAddressMessage = `${intl.formatMessage({
    id: ETranslations.wallet_no_address,
  })}`;

  if (hideAddress) {
    return null;
  }

  return address || isEmptyAddress ? (
    <>
      <Stack
        testID="account-item-value-address-splitter"
        mx="$1.5"
        w="$1"
        h="$1"
        bg="$iconSubdued"
        borderRadius="$full"
      />
      <SizableText
        size="$bodyMd"
        color={isEmptyAddress ? '$textCaution' : '$textSubdued'}
      >
        {isEmptyAddress && linkedNetworkId ? noAddressMessage : address}
      </SizableText>
    </>
  ) : null;
}
