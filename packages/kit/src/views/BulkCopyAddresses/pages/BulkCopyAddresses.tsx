import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Form,
  Icon,
  Page,
  Select,
  SizableText,
  Stack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type {
  EModalBulkCopyAddressesRoutes,
  IModalBulkCopyAddressesParamList,
} from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '../../../components/AccountSelector';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';

function BulkCopyAddresses({
  route,
}: IPageScreenProps<
  IModalBulkCopyAddressesParamList,
  EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal
>) {
  const intl = useIntl();
  const { walletId, networkId } = route.params;

  const sharedStyles = getSharedInputStyles({
    size: 'large',
  });

  const form = useForm({
    defaultValues: {
      selectedWalletId: walletId,
      selectedNetworkId: networkId,
    },
    mode: 'onChange',
  });

  const { selectedWalletId, selectedNetworkId } = form.watch();

  const { result: availableWallets } = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      ignoreEmptySingletonWalletAccounts: true,
      ignoreNonBackedUpWallets: true,
      nestedHiddenWallets: true,
    });

    return wallets.filter(
      (wallet) =>
        !accountUtils.isQrWallet({ walletId: wallet.id }) &&
        !accountUtils.isOthersWallet({ walletId: wallet.id }),
    );
  }, []);

  const { result: availableNetworksIds } = usePromiseResult(async () => {
    if (!selectedWalletId) {
      return [];
    }

    const { networks } = await backgroundApiProxy.serviceNetwork.getAllNetworks(
      {
        excludeAllNetworkItem: true,
      },
    );
    const networkIds = networks.map((network) => network.id);
    const { networkIdsCompatible } =
      await backgroundApiProxy.serviceNetwork.getNetworkIdsCompatibleWithWalletId(
        {
          walletId: selectedWalletId,
          networkIds,
        },
      );
    return networkIdsCompatible;
  }, [selectedWalletId]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses,
        })}
      />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            name="selectedWalletId"
            label={intl.formatMessage({
              id: ETranslations.global_wallet,
            })}
          >
            <Select
              title={intl.formatMessage({
                id: ETranslations.global_select_wallet,
              })}
              items={availableWallets?.map((wallet) => ({
                label: wallet.name,
                value: wallet.id,
                leading: <WalletAvatar wallet={wallet} size="$6" />,
              }))}
              renderTrigger={({ value, label }) => {
                const selectedWallet = availableWallets?.find(
                  (wallet) => wallet.id === value,
                );
                return (
                  // eslint-disable-next-line props-checker/validator
                  <Stack
                    userSelect="none"
                    flexDirection="row"
                    alignItems="center"
                    borderRadius="$3"
                    borderWidth={1}
                    borderCurve="continuous"
                    borderColor="$borderStrong"
                    px="$3"
                    py="$2.5"
                    $gtMd={{
                      borderRadius: '$2',
                      py: '$2',
                    }}
                    hoverStyle={{
                      bg: '$bgHover',
                    }}
                    pressStyle={{
                      bg: '$bgActive',
                    }}
                  >
                    <WalletAvatar wallet={selectedWallet} size="$6" />
                    <SizableText flex={1} px={sharedStyles.px} size="$bodyLg">
                      {label}
                    </SizableText>
                    <Icon
                      name="ChevronDownSmallOutline"
                      mr="$-0.5"
                      color="$iconSubdued"
                    />
                  </Stack>
                );
              }}
            />
          </Form.Field>
          <Form.Field
            name="selectedNetworkId"
            label={intl.formatMessage({
              id: ETranslations.global_network,
            })}
          >
            <ControlledNetworkSelectorTrigger
              networkIds={availableNetworksIds}
            />
          </Form.Field>
        </Form>
      </Page.Body>
    </Page>
  );
}

export default BulkCopyAddresses;
