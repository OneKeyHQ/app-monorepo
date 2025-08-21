import { type ComponentProps, useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  Icon,
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
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
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
}: {
  accountId: string;
  networkId: string;
  deriveInfoItems?: IAccountDeriveInfoItems[];
  indexedAccountId?: string;
  mergeDeriveAssetsEnabled?: boolean;
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
            networkAccounts.map(async (networkAccount) =>
              backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
                networkId,
                accountId: networkAccount.account?.id ?? '',
                withNonce: false,
                withFrozenBalance: true,
                withCheckInscription,
              }),
            ),
          );

          r.deriveItems = [];

          resp.forEach((item, index) => {
            r.balanceParsed = new BigNumber(r.balanceParsed ?? 0)
              .plus(item.balanceParsed ?? 0)
              .toFixed();
            r.totalBalanceParsed = new BigNumber(r.totalBalanceParsed ?? 0)
              .plus(item.totalBalanceParsed ?? 0)
              .toFixed();
            r.frozenBalanceParsed = new BigNumber(r.frozenBalanceParsed ?? 0)
              .plus(item.frozenBalanceParsed ?? 0)
              .toFixed();

            r.deriveItems?.push({
              deriveType: networkAccounts[index].deriveInfo.label ?? '',
              balanceParsed: item.balanceParsed ?? '0',
              totalBalanceParsed: item.totalBalanceParsed ?? '0',
              frozenBalanceParsed: item.frozenBalanceParsed ?? '0',
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
                openUrlExternal(whatIsFrozenBalanceUrl);
              }}
            >
              {appLocale.intl.formatMessage({
                id: ETranslations.balance_detail_frozen,
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
                    openUrlExternal(howToTransferOrdinalsAssetsUrl);
                  }}
                  hoverStyle={{
                    opacity: 0.75,
                  }}
                >
                  <SizableText size="$bodyMd" color="$textSubdued" mr="$1.5">
                    {appLocale.intl.formatMessage({
                      id: ETranslations.open_ordinals_transfer_tutorial_url_message,
                    })}
                  </SizableText>
                  <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
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
}) =>
  Dialog.show({
    icon: 'CryptoCoinOutline',
    renderContent: (
      <BalanceDetailsContent
        accountId={accountId}
        networkId={networkId}
        deriveInfoItems={deriveInfoItems}
        indexedAccountId={indexedAccountId}
        mergeDeriveAssetsEnabled={mergeDeriveAssetsEnabled}
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
