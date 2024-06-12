import {
  Button,
  Dialog,
  ESwitchSize,
  NumberSizeableText,
  SizableText,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchAccountDetailsResp } from '@onekeyhq/shared/types/address';

function BalanceDetailsContent({
  accountId,
  networkId,
  isProtectionInscription,
  onToggleProtectionInscription,
}: {
  accountId: string;
  networkId: string;
  isProtectionInscription?: boolean;
  onToggleProtectionInscription?: (value: boolean) => void;
}) {
  const [settings] = useSettingsPersistAtom();
  const {
    result: {
      overview = {} as IFetchAccountDetailsResp,
      network = {} as IServerNetwork,
    } = {},
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!accountId || !networkId) return;
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      const n = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      });
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId,
          accountAddress,
          xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
            accountId,
            networkId,
          }),
          withNonce: false,
          withCheckInscription: true,
          withFrozenBalance: true,
        });
      return { overview: r, network: n };
    },
    [accountId, networkId],
    {
      watchLoading: true,
    },
  );

  const helpLink = useHelpLink({
    path: 'articles/9810415108111',
  });

  return (
    <YStack>
      <SizableText mt="$-4" size="$headingSm" color="$textSubdued">
        {appLocale.intl.formatMessage({
          id: ETranslations.balance_detail_spendable,
        })}
      </SizableText>
      <NumberSizeableText
        pt="$2"
        pb="$4"
        size="$heading3xl"
        formatter="balance"
        formatterOptions={{
          tokenSymbol: network.symbol,
        }}
      >
        {overview?.availableBalanceParsed ?? '-'}
      </NumberSizeableText>
      <YStack>
        <XStack py="$2" justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyLgMedium">
            {appLocale.intl.formatMessage({
              id: ETranslations.balance_detail_total,
            })}
          </SizableText>
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{
              tokenSymbol: network.symbol,
            }}
          >
            {overview?.balanceParsed ?? '-'}
          </NumberSizeableText>
        </XStack>
        <XStack py="$2" justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyLgMedium">
            {appLocale.intl.formatMessage({
              id: ETranslations.balance_detail_frozen_by_inscription,
            })}
          </SizableText>
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            formatterOptions={{
              tokenSymbol: network.symbol,
            }}
          >
            {overview?.frozenBalanceParsed ?? '-'}
          </NumberSizeableText>
        </XStack>
        <XStack py="$2" justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyLgMedium">Inscription Protection</SizableText>
          <Switch
            size={ESwitchSize.large}
            value={isProtectionInscription}
            onChange={onToggleProtectionInscription}
          />
        </XStack>
        <XStack py="$2" justifyContent="flex-start">
          <Button
            icon="QuestionmarkOutline"
            variant="tertiary"
            size="small"
            onPress={() => {
              openUrlExternal(helpLink);
            }}
          >
            {appLocale.intl.formatMessage({
              id: ETranslations.balance_detail_what_is_frozen_balance,
            })}
          </Button>
        </XStack>
      </YStack>
    </YStack>
  );
}

export const showBalanceDetailsDialog = ({
  accountId,
  networkId,
  isProtectionInscription,
  onToggleProtectionInscription,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
  isProtectionInscription?: boolean;
  onToggleProtectionInscription?: (value: boolean) => void;
}) =>
  Dialog.show({
    icon: 'CoinOutline',
    renderContent: (
      <BalanceDetailsContent accountId={accountId} networkId={networkId} />
    ),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.balance_detail_button_done,
    }),
    onConfirm: async ({ close }) => {
      Toast.success({
        title: appLocale.intl.formatMessage({
          id: ETranslations.feedback_change_saved,
        }),
      });
      await close();
    },
    ...dialogProps,
  });
