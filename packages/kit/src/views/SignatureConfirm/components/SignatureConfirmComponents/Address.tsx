import { useIntl } from 'react-intl';

import { Badge, Icon, IconButton, XStack } from '@onekeyhq/components';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
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

      <XStack alignItems="flex-start" justifyContent="space-between">
        <SignatureConfirmItem.Value
          flex={1}
          maxWidth="$96"
          style={{ wordBreak: 'break-all' }}
        >
          {component.address}
        </SignatureConfirmItem.Value>
        {component.isNavigable ? (
          <XStack gap="$3" ml="$5">
            <IconButton
              title={intl.formatMessage({
                id: ETranslations.global_view_in_blockchain_explorer,
              })}
              variant="tertiary"
              icon="OpenOutline"
              size="small"
              onPress={() =>
                openExplorerAddressUrl({
                  networkId,
                  address: component.address,
                  openInExternal: true,
                })
              }
            />
          </XStack>
        ) : null}
      </XStack>

      {(accountId && networkId && showAddressLocalTags) ||
      component.tags.length ? (
        <XStack gap="$1" flexWrap="wrap" flex={1}>
          {accountId && networkId && showAddressLocalTags ? (
            <AddressInfo
              accountId={accountId}
              networkId={networkId}
              address={component.address}
              withWrapper={false}
            />
          ) : null}
          {component.tags?.map((tag) =>
            tag.icon ? (
              <Badge key={tag.value} badgeType={tag.displayType}>
                <XStack gap="$1" alignItems="center">
                  <Icon name={tag.icon} width={16} height={16} />
                  <Badge.Text>{tag.value}</Badge.Text>
                </XStack>
              </Badge>
            ) : (
              <Badge key={tag.value} badgeType={tag.displayType}>
                {tag.value}
              </Badge>
            ),
          )}
        </XStack>
      ) : null}
    </SignatureConfirmItem>
  );
}

export { Address };
