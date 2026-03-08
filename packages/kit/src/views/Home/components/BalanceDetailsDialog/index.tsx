import { type ComponentProps, useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  SizableText,
  Skeleton,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import {
  isTaprootAddress,
  isTaprootPath,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveInfoItems } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IFetchAccountDetailsResp } from '@onekeyhq/shared/types/address';

const detailsBlockStyles: ComponentProps<typeof Stack> = {
  borderRadius: '$2',
  backgroundColor: '$bgStrong',
  py: '$2',
  px: '$3',
};

function BalanceDetailsContent({
  accountId,
  networkId,
  deriveInfoItems,
  indexedAccountId,
  mergeDeriveAssetsEnabled,
  onClose,
}: {
  accountId: string;
  networkId: string;
  deriveInfoItems?: IAccountDeriveInfoItems[];
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
  onClose?: () => void;
}) {
  const [settings, setSettings] = useSettingsPersistAtom();
  const { result } = usePromiseResult(async () => {
    const [vaultSettings, { networkAccounts: n }] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      }),
      backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId,
          indexedAccountId: indexedAccountId ?? '',
          excludeEmptyAccount: true,
        },
      ),
    ]);

    const i =
      await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
        {
          networkId,
          accountId,
          mergeDeriveAssetsEnabled:
            mergeDeriveAssetsEnabled ?? vaultSettings?.mergeDeriveAssetsEnabled,
        },
      );

    const s = !!(
      vaultSettings.mergeDeriveAssetsEnabled &&
      !accountUtils.isOthersAccount({
        accountId,
      }) &&
      deriveInfoItems &&
      deriveInfoItems?.length > 1
    );

    return {
      inscriptionEnabled: i,
      showDeriveItems: s,
      networkAccounts: n,
    };
  }, [
    networkId,
    indexedAccountId,
    accountId,
    mergeDeriveAssetsEnabled,
    deriveInfoItems,
  ]);

  const { inscriptionEnabled, showDeriveItems, networkAccounts } = result ?? {};

  const {
    result: { overview, network, account } = {
      overview: undefined,
      network: undefined,
      account: undefined,
    },
    isLoading,
  } = usePromiseResult(
    async () => {
      if (
        !accountId ||
        !networkId ||
        isUndefined(inscriptionEnabled) ||
        isUndefined(showDeriveItems) ||
        isUndefined(networkAccounts)
      )
        return;
      const n = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      });
      const a = await backgroundApiProxy.serviceAccount.getAccount({
        networkId,
        accountId,
      });
      const withCheckInscription =
        inscriptionEnabled && settings.inscriptionProtection;
      let r: Partial<IFetchAccountDetailsResp> & {
        deriveItems?: {
          deriveType: string;
          balanceParsed: string;
          totalBalanceParsed: string;
          frozenBalanceParsed: string;
        }[];
      } = {};

      try {
        if (showDeriveItems) {
          const resp = await Promise.all(
            networkAccounts.map(async (networkAccount) => {
              // Only check inscription and frozen balance for Taproot (BIP86) addresses
              const isTaproot = networkAccount.deriveType === 'BIP86';
              return backgroundApiProxy.serviceAccountProfile.fetchAccountDetails(
                {
                  networkId,
                  accountId: networkAccount.account?.id ?? '',
                  withNonce: false,
                  withFrozenBalance: isTaproot,
                  withCheckInscription: isTaproot
                    ? withCheckInscription
                    : false,
                },
              );
            }),
          );

          r.deriveItems = [];

          resp.forEach((item, index) => {
            // For non-Taproot accounts, totalBalanceParsed is not returned from API
            // In this case, use balanceParsed as totalBalanceParsed (no frozen balance)
            const itemTotalBalance =
              item.totalBalanceParsed ?? item.balanceParsed ?? '0';
            const itemFrozenBalance = item.frozenBalanceParsed ?? '0';

            r.balanceParsed = new BigNumber(r.balanceParsed ?? 0)
              .plus(item.balanceParsed ?? 0)
              .toFixed();
            r.totalBalanceParsed = new BigNumber(r.totalBalanceParsed ?? 0)
              .plus(itemTotalBalance)
              .toFixed();
            r.frozenBalanceParsed = new BigNumber(r.frozenBalanceParsed ?? 0)
              .plus(itemFrozenBalance)
              .toFixed();

            r.deriveItems?.push({
              deriveType: networkAccounts[index].deriveInfo.label ?? '',
              balanceParsed: item.balanceParsed ?? '0',
              totalBalanceParsed: itemTotalBalance,
              frozenBalanceParsed: itemFrozenBalance,
            });
          });
        } else {
          r =
            await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
              networkId,
              accountId,
              withNonce: false,
              withFrozenBalance: true,
              withCheckInscription,
            });
        }
      } catch {
        r = {
          balanceParsed: '-',
          totalBalanceParsed: '-',
          frozenBalanceParsed: '-',
        } as IFetchAccountDetailsResp;
      }
      return {
        overview: r,
        account: a,
        network: n,
      };
    },
    [
      accountId,
      networkId,
      inscriptionEnabled,
      showDeriveItems,
      settings.inscriptionProtection,
      networkAccounts,
    ],
    {
      watchLoading: true,
    },
  );

  const whatIsFrozenBalanceUrl = useHelpLink({
    path: 'articles/11461179',
  });

  const howToTransferOrdinalsAssetsUrl = useHelpLink({
    path: 'articles/11461175',
  });

  const renderFrozenBalance = useCallback(() => {
    if (!deriveInfoItems && networkUtils.isBTCNetwork(networkId)) {
      if (
        !(
          isTaprootAddress(account?.address ?? '') ||
          isTaprootPath(account?.path ?? '')
        )
      ) {
        return null;
      }
    }
    return (
      <YStack {...(detailsBlockStyles as IYStackProps)}>
        <XStack justifyContent="space-between" alignItems="center">
          <XStack>
            <Button
              variant="tertiary"
              iconAfter="QuestionmarkOutline"
              color="$textSubdued"
              onPress={() => {
                if (platformEnv.isDesktop || platformEnv.isNative) {
                  onClose?.();
                  openUrlInDiscovery({ url: whatIsFrozenBalanceUrl });
                } else {
                  openUrlExternal(whatIsFrozenBalanceUrl);
                }
              }}
            >
              {appLocale.intl.formatMessage({
                id: ETranslations.balance_detail_protected_ordinals,
              })}
            </Button>
          </XStack>
          {isLoading ? (
            <Skeleton.BodyLg />
          ) : (
            <SizableText textAlign="right" size="$bodyLgMedium" minWidth={125}>
              {`${overview?.frozenBalanceParsed ?? '-'} ${
                network?.symbol ?? ''
              }`}
            </SizableText>
          )}
        </XStack>
        {showDeriveItems && networkAccounts ? (
          <YStack gap="$2" mt="$3">
            {networkAccounts.map((item, index) => {
              if (item.deriveType === 'BIP86') {
                return (
                  <XStack
                    justifyContent="space-between"
                    alignItems="center"
                    key={item.deriveType}
                  >
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {item.deriveInfo.label ?? ''}
                    </SizableText>
                    {isLoading ? (
                      <Skeleton.BodyMd />
                    ) : (
                      <SizableText
                        textAlign="right"
                        size="$bodyMd"
                        color="$textSubdued"
                      >
                        {`${
                          overview?.deriveItems?.[index]?.frozenBalanceParsed ??
                          '-'
                        } ${network?.symbol ?? ''}`}
                      </SizableText>
                    )}
                  </XStack>
                );
              }
              return null;
            })}
          </YStack>
        ) : null}
        {inscriptionEnabled ? (
          <>
            <Divider my="$3" />
            <XStack justifyContent="space-between" alignItems="center">
              <Stack>
                <SizableText size="$bodyLgMedium" color="$textSubdued">
                  {appLocale.intl.formatMessage({
                    id: ETranslations.balance_detail_frozen_by_inscription,
                  })}
                </SizableText>
                <XStack
                  alignItems="center"
                  userSelect="none"
                  onPress={() => {
                    if (platformEnv.isDesktop || platformEnv.isNative) {
                      onClose?.();
                      openUrlInDiscovery({
                        url: howToTransferOrdinalsAssetsUrl,
                      });
                    } else {
                      openUrlExternal(howToTransferOrdinalsAssetsUrl);
                    }
                  }}
                  hoverStyle={{
                    opacity: 0.75,
                  }}
                >
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {appLocale.intl.formatMessage({
                      id: ETranslations.open_ordinals_transfer_tutorial_url_message,
                    })}
                  </SizableText>
                </XStack>
              </Stack>
              <Switch
                size={ESwitchSize.small}
                value={settings.inscriptionProtection}
                onChange={(value) => {
                  setSettings((v) => ({
                    ...v,
                    inscriptionProtection: value,
                  }));
                }}
              />
            </XStack>
          </>
        ) : null}
      </YStack>
    );
  }, [
    account?.address,
    account?.path,
    deriveInfoItems,
    howToTransferOrdinalsAssetsUrl,
    inscriptionEnabled,
    isLoading,
    network?.symbol,
    networkAccounts,
    networkId,
    onClose,
    overview?.deriveItems,
    overview?.frozenBalanceParsed,
    setSettings,
    settings.inscriptionProtection,
    showDeriveItems,
    whatIsFrozenBalanceUrl,
  ]);

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>
          {isLoading ? (
            <Skeleton.Heading3Xl />
          ) : (
            <SizableText size="$heading3xl">
              {`${overview?.balanceParsed ?? '-'} ${network?.symbol ?? ''}`}
            </SizableText>
          )}
        </Dialog.Title>
        <Dialog.Description>
          {appLocale.intl.formatMessage({
            id: ETranslations.balance_detail_spendable,
          })}
        </Dialog.Description>
      </Dialog.Header>
      <YStack gap="$3">
        <YStack {...(detailsBlockStyles as IYStackProps)}>
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText size="$bodyLgMedium" color="$textSubdued">
              {appLocale.intl.formatMessage({
                id: ETranslations.balance_detail_total,
              })}
            </SizableText>
            {isLoading ? (
              <Skeleton.BodyLg />
            ) : (
              <SizableText textAlign="right" size="$bodyLgMedium">
                {`${overview?.totalBalanceParsed ?? '-'} ${
                  network?.symbol ?? ''
                }`}
              </SizableText>
            )}
          </XStack>
          {showDeriveItems && networkAccounts ? (
            <YStack gap="$2" mt="$3">
              {networkAccounts.map((item, index) => (
                <XStack
                  justifyContent="space-between"
                  alignItems="center"
                  key={item.deriveType}
                >
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {networkAccounts[index]?.deriveInfo.label ?? ''}
                  </SizableText>
                  {isLoading ? (
                    <Skeleton.BodyMd />
                  ) : (
                    <SizableText
                      textAlign="right"
                      size="$bodyMd"
                      color="$textSubdued"
                    >
                      {`${
                        overview?.deriveItems?.[index]?.totalBalanceParsed ??
                        '-'
                      } ${network?.symbol ?? ''}`}
                    </SizableText>
                  )}
                </XStack>
              ))}
            </YStack>
          ) : null}
        </YStack>
        {renderFrozenBalance()}
      </YStack>
    </>
  );
}

export const showBalanceDetailsDialog = ({
  accountId,
  networkId,
  indexedAccountId,
  deriveInfoItems,
  mergeDeriveAssetsEnabled,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  deriveInfoItems?: IAccountDeriveInfoItems[];
  mergeDeriveAssetsEnabled?: boolean;
}) => {
  const dialogInstance = Dialog.show({
    icon: 'CryptoCoinOutline',
    renderContent: (
      <BalanceDetailsContent
        accountId={accountId}
        networkId={networkId}
        deriveInfoItems={deriveInfoItems}
        indexedAccountId={indexedAccountId}
        mergeDeriveAssetsEnabled={mergeDeriveAssetsEnabled}
        onClose={() => {
          void dialogInstance?.close();
        }}
      />
    ),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_ok,
    }),
    onConfirm: async ({ close }) => {
      await close();
    },
    ...dialogProps,
  });
  return dialogInstance;
};
