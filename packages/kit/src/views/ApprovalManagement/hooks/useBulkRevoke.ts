import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { LinkedDeck } from '../../../hooks/useLinkedList';
import { usePrimeAuthV2 } from '../../Prime/hooks/usePrimeAuthV2';
import { usePrimeAvailable } from '../../Prime/hooks/usePrimeAvailable';

import type { IHasId } from '../../../hooks/useLinkedList';

function useBulkRevoke() {
  const intl = useIntl();
  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = usePrimeAuthV2();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.privyUserId;

  const [isBuildingRevokeTxs, setIsBuildingRevokeTxs] = useState(false);
  const navigation = useAppNavigation();

  const navigationToBulkRevoke = useCallback(
    async ({ unsignedTxs }: { unsignedTxs: (IUnsignedTxPro & IHasId)[] }) => {
      navigation.push(EModalApprovalManagementRoutes.BulkRevoke, {
        params: {
          unsignedTxs,
        },
      });
    },
    [navigation],
  );

  const navigationToOneByOneRevoke = useCallback(
    async ({ unsignedTxs }: { unsignedTxs: (IUnsignedTxPro & IHasId)[] }) => {
      navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
        screen: EModalSignatureConfirmRoutes.TxConfirm,
        params: {
          accountId: unsignedTxs[0].accountId as string,
          networkId: unsignedTxs[0].networkId as string,
          unsignedTxs: [unsignedTxs[0]],
          isQueueMode: true,
          unsignedTxQueue: new LinkedDeck<IUnsignedTxPro & IHasId>(unsignedTxs),
        },
      });
    },
    [navigation],
  );

  const navigationToBulkRevokeProcess = useCallback(
    async ({
      selectedTokens,
      tokenMap,
    }: {
      selectedTokens: Record<string, boolean>;
      tokenMap: Record<
        string,
        {
          price: string;
          info: IToken;
        }
      >;
    }) => {
      setIsBuildingRevokeTxs(true);

      const selectedTokensArray = Object.entries(selectedTokens)
        .map(([key, value]) => {
          const { accountId, networkId, contractAddress, tokenAddress } =
            approvalUtils.parseSelectedTokenKey({
              selectedTokenKey: key,
            });

          if (value) {
            return {
              accountId,
              networkId,
              contractAddress,
              tokenAddress,
            };
          }

          return null;
        })
        .filter((item) => item !== null);

      const revokeInfos: (IApproveInfo & {
        accountId: string;
        networkId: string;
      })[] = [];

      for (const item of selectedTokensArray) {
        const { accountId, networkId, contractAddress, tokenAddress } = item;
        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            networkId,
            accountId,
          });
        revokeInfos.push({
          accountId,
          networkId,
          owner: accountAddress,
          spender: contractAddress,
          amount: '0',
          tokenInfo:
            tokenMap[
              approvalUtils.buildTokenMapKey({
                networkId,
                tokenAddress,
              })
            ].info,
        });
      }

      const unsignedTxs: (IUnsignedTxPro & IHasId)[] = [];

      for (const revokeInfo of revokeInfos) {
        const { accountId, networkId, owner, spender, amount, tokenInfo } =
          revokeInfo;
        const unsignedTx =
          await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
            networkId,
            accountId,
            approveInfo: { owner, spender, amount, tokenInfo },
            withoutNonce: true,
            withUuid: true,
          });
        unsignedTxs.push(unsignedTx as IUnsignedTxPro & IHasId);
      }

      setIsBuildingRevokeTxs(false);

      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.wallet_approval_bulk_revoke,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.wallet_approval_bulk_revoke_prime_description,
          },
          {
            number: unsignedTxs.length,
          },
        ),
        confirmButtonProps: {
          icon: isPrimeAvailable ? 'PrimeOutline' : undefined,
        },
        onConfirm: () => {
          if (isPrimeAvailable) {
            if (isPrimeUser) {
              void navigationToBulkRevoke({
                unsignedTxs,
              });
            } else {
              navigation.pushFullModal(EModalRoutes.PrimeModal, {
                screen: EPrimePages.PrimeFeatures,
                params: {
                  showAllFeatures: false,
                  selectedFeature: EPrimeFeatures.BulkRevoke,
                  selectedSubscriptionPeriod: 'P1Y',
                },
              });
            }
          } else {
            void navigationToBulkRevoke({
              unsignedTxs,
            });
          }

          void dialog.close();
        },
        onCancel: () => {
          void dialog.close();
        },
      });
    },
    [intl, isPrimeAvailable, isPrimeUser, navigation, navigationToBulkRevoke],
  );

  return {
    isBuildingRevokeTxs,
    navigationToBulkRevoke,
    navigationToOneByOneRevoke,
    navigationToBulkRevokeProcess,
  };
}

export { useBulkRevoke };
