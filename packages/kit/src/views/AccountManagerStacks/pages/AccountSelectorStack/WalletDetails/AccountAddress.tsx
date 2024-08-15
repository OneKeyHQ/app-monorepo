import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function AccountAddress({
  num,
  address,
  linkedNetworkId,
  isEmptyAddress,
}: {
  num: number;
  address: string;
  linkedNetworkId?: string;
  isEmptyAddress: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num });
  const intl = useIntl();
  return address || isEmptyAddress ? (
    <SizableText
      size="$bodyMd"
      color={isEmptyAddress ? '$textCaution' : '$textSubdued'}
    >
      {isEmptyAddress && linkedNetworkId
        ? intl.formatMessage(
            { id: ETranslations.global_no_network_address },
            {
              network:
                linkedNetworkId === activeAccount?.network?.id
                  ? activeAccount?.network?.shortname || ''
                  : '',
              //   network: '11',
            },
          )
        : address}
    </SizableText>
  ) : null;
}
