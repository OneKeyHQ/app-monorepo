import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Dialog,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import type {
  IApproval,
  IContractApproval,
} from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { LinkedDeck } from '../../../hooks/useLinkedList';
import { usePrimeAvailable } from '../../Prime/hooks/usePrimeAvailable';

import type { IHasId } from '../../../hooks/useLinkedList';

function useBulkRevoke() {
  const intl = useIntl();
  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = useOneKeyAuth();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;

  const [isBuildingRevokeTxs, setIsBuildingRevokeTxs] = useState(false);
  const navigation = useAppNavigation();

  const navigationToBulkRevoke = useCallback(
    async ({
      unsignedTxs,
      contractMap,
    }: {
      unsignedTxs: (IUnsignedTxPro & IHasId)[];
      contractMap: Record<string, IAddressInfo>;
    }) => {
      navigation.push(EModalApprovalManagementRoutes.BulkRevoke, {
        unsignedTxs,
        contractMap,
      });
    },
    [navigation],
  );

  const navigationToOneByOneRevoke = useCallback(
    async ({ unsignedTxs }: { unsignedTxs: (IUnsignedTxPro & IHasId)[] }) => {
      navigation.push(EModalApprovalManagementRoutes.TxConfirm, {
        accountId: unsignedTxs[0].accountId as string,
        networkId: unsignedTxs[0].networkId as string,
        unsignedTxs: [unsignedTxs[0]],
        isQueueMode: unsignedTxs.length > 1,
        unsignedTxQueue:
          unsignedTxs.length > 1
            ? new LinkedDeck<IUnsignedTxPro & IHasId>(unsignedTxs)
            : undefined,
      });
    },
    [navigation],
  );

  const navigationToBulkRevokeProcess = useCallback(
    async ({
      selectedTokens,
      tokenMap,
      contractMap,
      approvals,
    }: {
      selectedTokens: Record<string, boolean>;
      tokenMap: Record<
        string,
        {
          price: string;
          info: IToken;
        }
      >;
      contractMap: Record<string, IAddressInfo>;
      approvals: IContractApproval[];
    }) => {
      setIsBuildingRevokeTxs(true);
      const approvalBySelectedTokenKey = new Map<
        string,
        {
          contractApproval: IContractApproval;
          approval: IApproval;
        }
      >();
      approvals.forEach((contractApproval) => {
        contractApproval.approvals.forEach((approval) => {
          approvalBySelectedTokenKey.set(
            approvalUtils.buildSelectedTokenKey({
              accountId: contractApproval.accountId,
              networkId: contractApproval.networkId,
              contractAddress: contractApproval.contractAddress,
              tokenAddress: approval.tokenAddress,
              permit2Address: approval.permit2Address,
            }),
            { contractApproval, approval },
          );
        });
      });

      const selectedApprovalItems = Object.entries(selectedTokens)
        .filter(([, value]) => value)
        .map(([key]) => approvalBySelectedTokenKey.get(key));

      if (selectedApprovalItems.some((item) => !item)) {
        setIsBuildingRevokeTxs(false);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred_desc,
          }),
        });
        return;
      }
      const validSelectedApprovalItems = selectedApprovalItems.filter(
        (item): item is NonNullable<typeof item> => Boolean(item),
      );

      const revokeInfos: (IApproveInfo & {
        accountId: string;
        networkId: string;
      })[] = [];
      const unsignedTxs: (IUnsignedTxPro & IHasId)[] = [];

      try {
        for (const item of validSelectedApprovalItems) {
          const { contractApproval, approval } = item;
          const { accountId, networkId } = contractApproval;
          const hasPermit2Metadata = approvalUtils.hasPermit2ApprovalMetadata({
            approval,
          });
          const permit2Expiration = approval.permit2Address
            ? approvalUtils.normalizePermit2ExpirationMs(approval.expirationMs)
            : undefined;
          const tokenInfo =
            tokenMap[
              approvalUtils.buildTokenMapKey({
                networkId,
                tokenAddress: approval.tokenAddress,
              })
            ]?.info;
          if (!tokenInfo) {
            setIsBuildingRevokeTxs(false);
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_an_error_occurred_desc,
              }),
            });
            return;
          }
          if (
            hasPermit2Metadata &&
            (!approval.permit2Address || !permit2Expiration)
          ) {
            setIsBuildingRevokeTxs(false);
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.wallet_approval_permit2_data_invalid__msg,
              }),
            });
            return;
          }
          const accountAddress =
            await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
              networkId,
              accountId,
            });
          revokeInfos.push({
            accountId,
            networkId,
            owner: accountAddress,
            spender: approval.spenderAddress,
            amount: '0',
            tokenInfo,
            permit2Info:
              approval.permit2Address && permit2Expiration
                ? {
                    permit2Address: approval.permit2Address,
                    expirationSeconds: permit2Expiration.expirationSeconds,
                  }
                : undefined,
          });
        }

        for (const revokeInfo of revokeInfos) {
          const {
            accountId,
            networkId,
            owner,
            spender,
            amount,
            tokenInfo,
            permit2Info,
          } = revokeInfo;
          const unsignedTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId,
              accountId,
              approveInfo: {
                owner,
                spender,
                amount,
                tokenInfo,
                permit2Info,
              },
              withoutNonce: true,
              withUuid: true,
            });
          unsignedTxs.push(unsignedTx as IUnsignedTxPro & IHasId);
        }
      } catch (error) {
        setIsBuildingRevokeTxs(false);
        throw error;
      }

      setIsBuildingRevokeTxs(false);

      if (unsignedTxs.length === 1 || !isPrimeAvailable) {
        void navigationToOneByOneRevoke({
          unsignedTxs,
        });
        return;
      }

      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.wallet_approval_bulk_revoke_method_title,
        }),

        renderContent: (
          <YStack gap="$3">
            <ListItem
              mx="$0"
              drillIn
              nativePressableStyle={{ flexShrink: 0 }}
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              icon="HandPinchOutline"
              onPress={async () => {
                await dialog.close();

                void navigationToOneByOneRevoke({
                  unsignedTxs,
                });
              }}
              title={intl.formatMessage({
                id: ETranslations.wallet_approval_bulk_revoke_method_one_by_one_title,
              })}
              subtitle={intl.formatMessage({
                id: ETranslations.wallet_approval_bulk_revoke_method_one_by_one_desc,
              })}
            />
            <ListItem
              mx="$0"
              drillIn
              nativePressableStyle={{ flexShrink: 0 }}
              icon="FlashOutline"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              onPress={async () => {
                await dialog.close();

                if (isPrimeAvailable) {
                  if (isPrimeUser) {
                    void navigationToBulkRevoke({
                      unsignedTxs,
                      contractMap,
                    });
                  } else {
                    navigation.pushModal(EModalRoutes.PrimeModal, {
                      screen: EPrimePages.PrimeDashboard,
                      params: {
                        fromFeature: EPrimeFeatures.BulkRevoke,
                      },
                    });
                  }
                } else {
                  void navigationToBulkRevoke({
                    unsignedTxs,
                    contractMap,
                  });
                }
              }}
            >
              <ListItem.Text
                flex={1}
                primary={
                  <XStack alignItems="center" gap="$2">
                    <SizableText size="$bodyLgMedium">
                      {intl.formatMessage({
                        id: ETranslations.wallet_approval_bulk_revoke_method_bulk_revoke,
                      })}
                    </SizableText>
                    {!isPrimeUser ? (
                      <Badge badgeSize="sm">
                        <Badge.Text>
                          {intl.formatMessage({
                            id: ETranslations.prime_status_prime,
                          })}
                        </Badge.Text>
                      </Badge>
                    ) : null}
                  </XStack>
                }
                secondary={intl.formatMessage({
                  id: ETranslations.wallet_approval_bulk_revoke_method_bulk_desc,
                })}
              />
            </ListItem>
          </YStack>
        ),
        showCancelButton: false,
        showConfirmButton: false,
      });
    },
    [
      intl,
      isPrimeAvailable,
      isPrimeUser,
      navigation,
      navigationToBulkRevoke,
      navigationToOneByOneRevoke,
    ],
  );

  return {
    isBuildingRevokeTxs,
    navigationToBulkRevoke,
    navigationToOneByOneRevoke,
    navigationToBulkRevokeProcess,
  };
}

export { useBulkRevoke };
