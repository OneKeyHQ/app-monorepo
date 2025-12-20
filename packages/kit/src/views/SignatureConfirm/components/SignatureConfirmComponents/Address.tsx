import { useIntl } from 'react-intl';

import { Badge, Icon, IconButton, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IDisplayComponentAddress } from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IProps = {
  accountId?: string;
  networkId?: string;
  component: IDisplayComponentAddress;
  showAddressLocalTags?: boolean;
};

function formatTagValue(value: string | string[]) {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '';
  }
}

function Address(props: IProps) {
  const intl = useIntl();
  const {
    accountId,
    networkId: currentNetworkId,
    component,
    showAddressLocalTags,
  } = props;

  const networkId = component.networkId || currentNetworkId;

  const isLightningNetwork =
    networkUtils.isLightningNetworkByNetworkId(networkId);

  const accountName = usePromiseResult(async () => {
    if (!networkId || !isLightningNetwork) return;

    const r = await backgroundApiProxy.serviceAccount.getAccountNameFromAddress(
      {
        address: component.address,
        networkId,
      },
    );
    return r?.[0]?.accountName;
  }, [component.address, networkId, isLightningNetwork]).result;

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
          {component.showAccountName ? accountName : component.address}
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
          {component.tags?.map((tag) => {
            const value = formatTagValue(tag.value);
            if (value === '') {
              return null;
            }
            return tag.icon ? (
              <Badge key={value} badgeType={tag.displayType}>
                <XStack gap="$1" alignItems="center">
                  <Icon name={tag.icon} width={16} height={16} />
                  <Badge.Text>{value}</Badge.Text>
                </XStack>
              </Badge>
            ) : (
              <Badge key={value} badgeType={tag.displayType}>
                {value}
              </Badge>
            );
          })}
        </XStack>
      ) : null}
    </SignatureConfirmItem>
  );
}

export { Address };
