import type { ComponentProps } from 'react';

import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';

import {
  Dialog,
  ESwitchSize,
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveInfoItems } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
}: {
  accountId: string;
  networkId: string;
  deriveInfoItems?: IAccountDeriveInfoItems[];
  indexedAccountId?: string;
}) {
  const [settings, setSettings] = useSettingsPersistAtom();
  const { result } = usePromiseResult(async () => {
    const [i, vaultSettings, { networkAccounts: n }] = await Promise.all([
      backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled({
        networkId,
        accountId,
      }),
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      }),
      backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId,
          indexedAccountId: indexedAccountId ?? '',
        },
      ),
    ]);
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
  }, [networkId, accountId, indexedAccountId, deriveInfoItems]);

  const { inscriptionEnabled, showDeriveItems, networkAccounts } = result ?? {};

  const {
    result: { overview, network } = { overview: undefined, network: undefined },
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
    path: 'articles/9810415108111',
  });

  const howToTransferOrdinalsAssetsUrl = useHelpLink({
    path: 'articles/10072721909903',
  });

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
        <YStack {...detailsBlockStyles}>
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
        <YStack {...detailsBlockStyles}>
          <XStack justifyContent="space-between" alignItems="center">
            <XStack>
              <SizableText size="$bodyLgMedium" color="$textSubdued" pr="$2">
                {appLocale.intl.formatMessage({
                  id: ETranslations.balance_detail_frozen,
                })}
              </SizableText>
              <IconButton
                variant="tertiary"
                icon="QuestionmarkOutline"
                onPress={() => {
                  openUrlExternal(whatIsFrozenBalanceUrl);
                }}
                color="$iconSubdued"
              />
            </XStack>
            {isLoading ? (
              <Skeleton.BodyLg />
            ) : (
              <SizableText
                textAlign="right"
                size="$bodyLgMedium"
                minWidth={125}
              >
                {`${overview?.frozenBalanceParsed ?? '-'} ${
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
              ))}
            </YStack>
          ) : null}
        </YStack>
        {inscriptionEnabled ? (
          <XStack
            justifyContent="space-between"
            alignItems="center"
            {...detailsBlockStyles}
          >
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
        ) : null}
      </YStack>
    </>
  );
}

export const showBalanceDetailsDialog = ({
  accountId,
  networkId,
  indexedAccountId,
  deriveInfoItems,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  deriveInfoItems?: IAccountDeriveInfoItems[];
}) =>
  Dialog.show({
    icon: 'CryptoCoinOutline',
    renderContent: (
      <BalanceDetailsContent
        accountId={accountId}
        networkId={networkId}
        deriveInfoItems={deriveInfoItems}
        indexedAccountId={indexedAccountId}
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
