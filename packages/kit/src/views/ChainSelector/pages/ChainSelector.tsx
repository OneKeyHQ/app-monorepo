import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { PureChainSelector } from '../components/PureChainSelector';

export default function ChainSelectorPage({
  route,
  navigation,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.ChainSelector
>) {
  const intl = useIntl();
  const {
    onSelect,
    defaultNetworkId,
    networkIds,
    disableNetworkIds,
    grouped = true,
    excludeAllNetworkItem = true,
    closeAfterSelect = true,
    title = intl.formatMessage({ id: ETranslations.global_networks }),
    showNetworkValues,
    hideLowValueNetworkValue,
    indexedAccountId,
    accountId,
  } = route.params ?? {};
  const { result } = usePromiseResult(
    async () => {
      const resp = await backgroundApiProxy.serviceNetwork.getAllNetworks({
        excludeAllNetworkItem,
      });
      let networks: IServerNetwork[] = resp.networks;
      let disableNetwork: IServerNetwork[] | undefined;
      if (disableNetworkIds && disableNetworkIds.length > 0) {
        disableNetwork = networks.filter((o) =>
          disableNetworkIds.includes(o.id),
        );
      }
      if (networkIds && networkIds.length > 0) {
        const networkIdIndex = networkIds.reduce(
          (acc, item, index) => {
            acc[item] = index;
            return acc;
          },
          {} as Record<string, number>,
        );
        networks = networks.filter((o) => {
          let isOK = networkIds.includes(o.id);
          if (disableNetworkIds && disableNetworkIds?.length > 0) {
            isOK = isOK && !disableNetworkIds.includes(o.id);
          }
          return isOK;
        });
        networks.sort((a, b) => networkIdIndex[a.id] - networkIdIndex[b.id]);
      }

      let accountNetworkValues: Record<string, string> | undefined;
      let accountNetworkValueCurrency: string | undefined;
      if (showNetworkValues) {
        let valueAccountId = indexedAccountId || '';
        if (!valueAccountId && accountId) {
          if (accountUtils.isOthersAccount({ accountId })) {
            valueAccountId = accountId;
          } else {
            // For HD/HW accounts, values are stored under indexedAccountId
            const dbAccount =
              await backgroundApiProxy.serviceAccount.getDBAccountSafe({
                accountId,
              });
            valueAccountId = dbAccount?.indexedAccountId || accountId;
          }
        }
        if (valueAccountId) {
          const accountsValue =
            await backgroundApiProxy.serviceAccountProfile.getAllNetworkAccountsValue(
              {
                accounts: [{ accountId: valueAccountId }],
              },
            );
          // Raw values use compound keys "accountId_networkId" (via buildAccountValueKey).
          // Extract plain networkId keys for display lookup.
          const rawValues = accountsValue[0]?.value ?? {};
          const formattedValues: Record<string, string> = {};
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: valueAccountId,
          });
          for (const [key, val] of Object.entries(rawValues)) {
            const keyArray = key.split('_');
            const networkId = keyArray.pop() as string;
            // eslint-disable-next-line @typescript-eslint/no-shadow
            const accountId = keyArray.join('_');
            const [_walletId, _path, _deriveType] = accountId.split(
              SEPERATOR,
            ) as [string, string, string];
            if (walletId === _walletId && networkId) {
              formattedValues[networkId] = val;
            }
          }
          accountNetworkValues = formattedValues;
          accountNetworkValueCurrency = accountsValue[0]?.currency;

          // Sort networks by value descending
          networks.sort((a, b) => {
            const valA = new BigNumber(formattedValues[a.id] || 0);
            const valB = new BigNumber(formattedValues[b.id] || 0);
            return valB.comparedTo(valA);
          });
        }
      }

      return {
        networks,
        disableNetwork,
        accountNetworkValues,
        accountNetworkValueCurrency,
      };
    },
    [
      networkIds,
      disableNetworkIds,
      excludeAllNetworkItem,
      showNetworkValues,
      indexedAccountId,
      accountId,
    ],
    {
      revalidateOnFocus: showNetworkValues,
    },
  );

  return (
    <PureChainSelector
      title={title}
      networkId={defaultNetworkId}
      networks={result?.networks ?? []}
      unavailable={result?.disableNetwork}
      grouped={grouped}
      accountNetworkValues={result?.accountNetworkValues}
      accountNetworkValueCurrency={result?.accountNetworkValueCurrency}
      hideLowValueNetworkValue={hideLowValueNetworkValue}
      onPressItem={(network) => {
        onSelect?.(network);
        if (closeAfterSelect) {
          navigation.goBack();
        }
      }}
    />
  );
}
