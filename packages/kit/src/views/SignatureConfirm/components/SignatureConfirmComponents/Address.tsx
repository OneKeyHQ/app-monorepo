import { useIntl } from 'react-intl';

import { Badge, XStack } from '@onekeyhq/components';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDisplayComponentAddress } from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  accountId?: string;
  networkId?: string;
  component: IDisplayComponentAddress;
  showAddressLocalTags?: boolean;
};
function Address(props: IProps) {
  const intl = useIntl();
  const { accountId, networkId, component, showAddressLocalTags } = props;
  return (
    <SignatureConfirmItem>
      <SignatureConfirmItem.Label>
        {component.label ||
          intl.formatMessage({ id: ETranslations.copy_address_modal_title })}
      </SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>
        {component.address}
      </SignatureConfirmItem.Value>
      {component.tags?.length ? (
        <XStack gap="$1">
          {accountId && networkId && showAddressLocalTags ? (
            <AddressInfo
              accountId={accountId}
              networkId={networkId}
              address={component.address}
            />
          ) : null}
          {component.tags?.map((tag) => (
            <Badge key={tag.name} badgeType={tag.type}>
              {tag.name}
            </Badge>
          ))}
        </XStack>
      ) : null}
    </SignatureConfirmItem>
  );
}

export { Address };
