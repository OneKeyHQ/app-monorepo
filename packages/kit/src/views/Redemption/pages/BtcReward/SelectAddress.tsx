import { useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Form,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
  useFormWatch,
} from '@onekeyhq/components';
import type { IFormMode, IReValidateMode } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import {
  AddressInput,
  createValidateAddressRule,
} from '@onekeyhq/kit/src/components/AddressInput';
import { AddressInputContext } from '@onekeyhq/kit/src/components/AddressInput/AddressInputContext';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import type { IBtcRewardCodeInfoParam } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAllWalletsAreBtcOnly } from './hooks/useAllWalletsAreBtcOnly';

import type { RouteProp } from '@react-navigation/core';

type IRouteParams = RouteProp<
  {
    BtcRewardSelectAddress: {
      codeInfo: IBtcRewardCodeInfoParam;
      voucherCode: string;
      quotaRemaining?: number;
    };
  },
  'BtcRewardSelectAddress'
>;

const baseNetworkId = getNetworkIdsMap().base;

function SelectAddressContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useRoute<IRouteParams>();
  const { codeInfo, voucherCode, quotaRemaining } = route.params;

  const { activeAccount, showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    linkNetwork: true,
    linkNetworkId: baseNetworkId,
  });
  const actions = useAccountSelectorActions();

  useEffect(() => {
    void (async () => {
      await actions.current.syncFromScene({
        from: {
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
          sceneNum: 0,
        },
        num: 0,
        availableNetworks: {
          networkIds: [baseNetworkId],
          defaultNetworkId: baseNetworkId,
        },
      });
      // Pin network to Base regardless of any cached network from the
      // addressInput scene (e.g. user previously sent on a non-Base chain).
      await actions.current.updateSelectedAccountNetwork({
        num: 0,
        networkId: baseNetworkId,
      });
    })();
  }, [actions]);

  const account = activeAccount?.account;
  const wallet = activeAccount?.wallet;
  const indexedAccount = activeAccount?.indexedAccount;
  const dbAccount = activeAccount?.dbAccount;
  const walletAddress = account?.address;

  // The address is locked at commit time, so reject wallets that cannot sign.
  const walletId = wallet?.id;
  const isUnsupportedWalletType = walletId
    ? accountUtils.isWatchingWallet({ walletId }) ||
      accountUtils.isExternalWallet({ walletId })
    : false;

  // Until syncFromScene + updateSelectedAccountNetwork settle, the active
  // network can still be whatever the addressInput scene last held; gate the
  // Next button so a fast click cannot commit a non-Base address.
  const isBaseNetwork = activeAccount?.network?.id === baseNetworkId;
  const canProceed =
    !!walletAddress && !isUnsupportedWalletType && isBaseNetwork;

  const handleNext = useCallback(() => {
    if (!canProceed || !walletAddress) return;
    navigation.push(EModalReferFriendsRoutes.BtcRewardConfirm, {
      codeInfo,
      voucherCode,
      walletAddress,
    });
  }, [navigation, canProceed, walletAddress, codeInfo, voucherCode]);

  const renderSelectedCard = () => (
    <XStack
      role="button"
      onPress={showAccountSelector}
      alignItems="center"
      gap="$3"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      p="$3"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      userSelect="none"
    >
      <AccountAvatar
        size="small"
        indexedAccount={indexedAccount}
        account={account}
        dbAccount={dbAccount}
        wallet={wallet}
      />
      <YStack flex={1} gap="$0.5">
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {wallet?.name
            ? `${wallet.name} / ${account?.name ?? ''}`
            : (account?.name ?? '')}
        </SizableText>
        {walletAddress ? (
          <XStack alignItems="center" gap="$1.5">
            <NetworkAvatar networkId={baseNetworkId} size="$4" />
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {accountUtils.shortenAddress({ address: walletAddress })}
            </SizableText>
          </XStack>
        ) : null}
      </YStack>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );

  const renderPlaceholderCard = () => (
    <XStack
      role="button"
      onPress={showAccountSelector}
      alignItems="center"
      gap="$3"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderStyle="dashed"
      p="$3"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      userSelect="none"
    >
      <Stack
        bg="$bgSubdued"
        borderRadius="$full"
        p="$2"
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="WalletOutline" size="$5" color="$iconSubdued" />
      </Stack>
      <SizableText flex={1} size="$bodyMdMedium" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_select_wallet })}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );

  const hasSelection = Boolean(account);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_btc_select_address_title,
        })}
      />
      <Page.Body px="$5" py="$4">
        <YStack gap="$4">
          {hasSelection ? renderSelectedCard() : renderPlaceholderCard()}

          {isUnsupportedWalletType ? (
            <Alert
              type="critical"
              title={intl.formatMessage({
                id: ETranslations.wallet_bulk_send_error_watching_account,
              })}
            />
          ) : (
            <Alert
              type="warning"
              title={intl.formatMessage({
                id: ETranslations.redemption_btc_select_address_alert_title,
              })}
              description={intl.formatMessage({
                id: ETranslations.redemption_btc_select_address_alert_desc,
              })}
            />
          )}
        </YStack>
      </Page.Body>

      <Page.Footer>
        <Page.FooterActions
          onConfirm={handleNext}
          onConfirmText={intl.formatMessage({ id: ETranslations.global_next })}
          confirmButtonProps={{ disabled: !canProceed }}
        >
          {quotaRemaining !== undefined ? (
            <SizableText size="$bodySm" color="$textSubdued" pb="$2">
              {intl.formatMessage(
                {
                  id: ETranslations.redemption_btc_verify_order_quota_remaining_desc,
                },
                { count: quotaRemaining },
              )}
            </SizableText>
          ) : null}
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

type IManualInputFormValues = {
  to: IAddressInputValue;
};

const MANUAL_INPUT_FORM_OPTIONS = {
  defaultValues: {
    to: { raw: '', resolved: undefined } as IAddressInputValue,
  },
  mode: 'onChange' as IFormMode,
  reValidateMode: 'onBlur' as IReValidateMode,
};

const MANUAL_INPUT_CONTEXT_VALUE = {
  name: 'to',
  networkId: baseNetworkId,
};

function ManualInputContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useRoute<IRouteParams>();
  const { codeInfo, voucherCode, quotaRemaining } = route.params;

  const form = useForm<IManualInputFormValues>(MANUAL_INPUT_FORM_OPTIONS);
  const { control } = form;
  const addressValue = useFormWatch({ control, name: 'to' });
  const { errors } = form.formState;

  const canProceed = useMemo(() => {
    if (Object.values(errors).length) return false;
    return !addressValue.pending && !!addressValue.resolved;
  }, [addressValue.pending, addressValue.resolved, errors]);

  const handleNext = useCallback(() => {
    const resolved = form.getValues('to').resolved;
    if (!canProceed || !resolved) return;
    navigation.push(EModalReferFriendsRoutes.BtcRewardConfirm, {
      codeInfo,
      voucherCode,
      walletAddress: resolved,
    });
  }, [canProceed, codeInfo, form, navigation, voucherCode]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_btc_select_address_title,
        })}
      />
      <Page.Body px="$5" py="$4">
        <YStack gap="$4">
          <AddressInputContext.Provider value={MANUAL_INPUT_CONTEXT_VALUE}>
            <Form form={form}>
              <Form.Field
                label={intl.formatMessage({
                  id: ETranslations.global_address,
                })}
                labelAddon={
                  <XStack alignItems="center" gap="$1.5" flexShrink={1}>
                    <NetworkAvatar networkId={baseNetworkId} size="$4" />
                    <SizableText
                      size="$bodyMdMedium"
                      numberOfLines={1}
                      flexShrink={1}
                    >
                      {intl.formatMessage({
                        id: ETranslations.redemption_btc_select_address_network_title,
                      })}
                    </SizableText>
                  </XStack>
                }
                name="to"
                rules={{
                  validate: createValidateAddressRule({
                    defaultErrorMessage: intl.formatMessage({
                      id: ETranslations.form_address_error_invalid,
                    }),
                  }),
                }}
              >
                <AddressInput
                  networkId={baseNetworkId}
                  placeholder={intl.formatMessage({
                    id: ETranslations.send_to_placeholder,
                  })}
                />
              </Form.Field>
            </Form>
          </AddressInputContext.Provider>

          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.redemption_btc_select_address_alert_title,
            })}
            description={intl.formatMessage({
              id: ETranslations.redemption_btc_select_address_network_desc,
            })}
          />
        </YStack>
      </Page.Body>

      <Page.Footer>
        <Page.FooterActions
          onConfirm={handleNext}
          onConfirmText={intl.formatMessage({ id: ETranslations.global_next })}
          confirmButtonProps={{ disabled: !canProceed }}
        >
          {quotaRemaining !== undefined ? (
            <SizableText size="$bodySm" color="$textSubdued" pb="$2">
              {intl.formatMessage(
                {
                  id: ETranslations.redemption_btc_verify_order_quota_remaining_desc,
                },
                { count: quotaRemaining },
              )}
            </SizableText>
          ) : null}
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

export default function SelectAddressPage() {
  const allWalletsAreBtcOnly = useAllWalletsAreBtcOnly();

  if (allWalletsAreBtcOnly) {
    return <ManualInputContent />;
  }

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.addressInput,
        sceneUrl: '',
      }}
      enabledNum={[0]}
      availableNetworksMap={{
        0: {
          networkIds: [baseNetworkId],
          defaultNetworkId: baseNetworkId,
        },
      }}
    >
      <SelectAddressContent />
    </AccountSelectorProviderMirror>
  );
}
