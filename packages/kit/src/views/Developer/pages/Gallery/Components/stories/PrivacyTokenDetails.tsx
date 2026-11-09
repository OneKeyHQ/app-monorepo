import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Dialog,
  Divider,
  Icon,
  Page,
  ScrollView,
  Select,
  SizableText,
  Spinner,
  Tabs,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  getBirthdayInputError,
  readEnableBirthday,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import {
  PrivacyEnableContent,
  createPrivacyEnableForm,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/PrivacyEnableContent';
import TokenDetailsBalanceHero from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsBalanceHero';
import { TokenPrivacyPanel } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenPrivacyPanel';
import type { ITokenPrivacyPanelState } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenPrivacyPanel';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import {
  ReceiveCard,
  ReceiveCardCell,
} from '@onekeyhq/kit/src/views/Receive/components/ReceiveCard';
import { ReceivePrivacyPromotion } from '@onekeyhq/kit/src/views/Receive/components/ReceivePrivacyPromotion';
import { ReceivePrivacyStatus } from '@onekeyhq/kit/src/views/Receive/components/ReceivePrivacyStatus';
import { ReceivePrivacySyncGate } from '@onekeyhq/kit/src/views/Receive/components/ReceivePrivacySyncGate';
import { ReceiveQRCode } from '@onekeyhq/kit/src/views/Receive/components/ReceiveQRCode';
import { ReceiveTitle } from '@onekeyhq/kit/src/views/Receive/components/ReceiveTitle';
import xmrSettings from '@onekeyhq/kit-bg/src/vaults/impls/xmr/settings';
import zcashSettings from '@onekeyhq/kit-bg/src/vaults/impls/zcash/settings';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import { PrivacyAccountManagementPreview } from './PrivacyAccountManagement';

type IPreviewChain = 'zec' | 'xmr';

const PREVIEW_NETWORKS = {
  zec: {
    symbol: 'ZEC',
    name: 'Zcash',
    logoURI: 'https://uni.onekey-asset.com/static/chain/zcash.png',
  },
  xmr: {
    symbol: 'XMR',
    name: 'Monero',
    logoURI: 'https://common.onekey-asset.com/chain/monero.png',
  },
};

const PREVIEW_STATES: {
  value: ITokenPrivacyPanelState;
  label: string;
}[] = [
  { value: 'disabled', label: 'Not enabled' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'syncing', label: 'Syncing' },
  { value: 'synced', label: 'Synced' },
  { value: 'stopped', label: 'Paused' },
  { value: 'error', label: 'Error' },
];

const PREVIEW_TABS = ['Public', 'Private'];

function PrivacyTokenDetailsPreview() {
  const intl = useIntl();
  const [chain, setChain] = useState<IPreviewChain>('zec');
  const [view, setView] = useState<'transparent' | 'private'>('transparent');
  const focusedTab = useSharedValue(PREVIEW_TABS[0]);
  const handleTabPress = useCallback(
    (name: string) => {
      if (!PREVIEW_TABS.includes(name)) return;
      focusedTab.value = name;
      setView(name === 'Private' ? 'private' : 'transparent');
    },
    [focusedTab],
  );
  const [state, setState] = useState<ITokenPrivacyPanelState>('disabled');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReceive, setShowReceive] = useState(true);
  const [walletScenario, setWalletScenario] = useState<'new' | 'existing'>(
    'existing',
  );
  const [receiveForms, setReceiveForms] = useState<
    Record<IPreviewChain, 'public' | 'private'>
  >({ zec: 'public', xmr: 'private' });
  const [simulateSetup, setSimulateSetup] = useState(false);
  const [mobileDataPaused, setMobileDataPaused] = useState(false);
  const [accountLimitReached, setAccountLimitReached] = useState(false);
  const receiveAddressForm = chain === 'xmr' ? 'private' : receiveForms[chain];
  const birthdayHintTimestamp =
    walletScenario === 'new' ? new Date(2026, 9, 12).getTime() : undefined;
  const [lastSyncedAt, setLastSyncedAt] = useState(() =>
    new Date(2026, 9, 27, 14, 17, 28).getTime(),
  );
  const openEnablePreview = useCallback(
    (fromReceive = false) => {
      if (accountLimitReached) {
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.privacy_slots_full__title,
          }),
          description: intl.formatMessage(
            { id: ETranslations.privacy_slots_full__desc },
            { max: 5, accountName: 'Preview account' },
          ),
          showConfirmButton: false,
          showCancelButton: true,
          onCancelText: intl.formatMessage({ id: ETranslations.global_close }),
        });
        return;
      }
      const networkId = chain === 'zec' ? 'zec--0' : 'xmr--0';
      const earliestBirthday = (chain === 'zec' ? zcashSettings : xmrSettings)
        .localWallet?.accountSetup.earliestBirthday;
      const formRef = createPrivacyEnableForm({ earliestBirthday });
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslationsMock.privacy_enable_account__title,
          defaultMessage: ETranslationsMock.privacy_enable_account__title,
        }),
        renderContent: (
          <PrivacyEnableContent
            networkId={networkId}
            accountId="privacy-preview-account"
            formRef={formRef}
            birthdayHintTimestamp={birthdayHintTimestamp}
            earliestBirthday={earliestBirthday}
          />
        ),
        showConfirmButton: true,
        showCancelButton: true,
        onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
        onConfirm: ({ preventClose }) => {
          if (
            !readEnableBirthday(formRef.current, earliestBirthday, networkId)
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: getBirthdayInputError(formRef.current.mode),
              }),
            });
            preventClose();
            return;
          }
          if (fromReceive) {
            setReceiveForms((forms) => ({ ...forms, [chain]: 'private' }));
          } else {
            handleTabPress('Private');
          }
          setState('preparing');
          setSimulateSetup(true);
        },
      });
    },
    [accountLimitReached, birthdayHintTimestamp, chain, handleTabPress, intl],
  );

  const resumePreview = useCallback(() => {
    setReceiveForms((forms) => ({ ...forms, [chain]: 'private' }));
    setState('preparing');
    setSimulateSetup(true);
  }, [chain]);

  useEffect(() => {
    if (!simulateSetup || state !== 'preparing') return;
    const timer = setTimeout(() => {
      setState('syncing');
      setSimulateSetup(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [chain, simulateSetup, state]);

  useEffect(() => {
    setIsRefreshing(false);
  }, [chain, state, view]);

  useEffect(() => {
    if (!isRefreshing) return;
    const timer = setTimeout(() => {
      setLastSyncedAt(Date.now());
      setIsRefreshing(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isRefreshing, chain, state, view]);

  const network = PREVIEW_NETWORKS[chain];
  const isPrivate = chain === 'xmr' || view === 'private';
  const isPrivateSynced = isPrivate && state === 'synced';
  const isPrivateSetup = isPrivate && state === 'disabled';
  const hasSampleBalance =
    !isPrivateSetup && (!isPrivate || state !== 'preparing');
  const sampleBalance = chain === 'zec' ? '1.2345' : '0.1234';
  const isPrivateReceive = receiveAddressForm === 'private';
  const receiveReady =
    !isPrivateReceive || state === 'syncing' || state === 'synced';
  const addressFormLabel = intl.formatMessage({
    id: isPrivateReceive
      ? ETranslations.private_send_private_option
      : ETranslations.privacy_balance_public__title,
  });

  let receiveContent: ReactNode;
  if (receiveReady) {
    receiveContent = (
      <>
        <ReceiveCardCell alignItems="center" py="$6" gap="$3">
          <ReceiveQRCode
            value={`OneKey UI preview — ${network.name} ${receiveAddressForm}. Not a payment address.`}
            size={220}
          />
          <SizableText size="$bodySm" color="$textSubdued">
            Demo QR · Do not send funds
          </SizableText>
        </ReceiveCardCell>
        <ReceiveCardCell p="$4" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            Sample address · UI preview only
          </SizableText>
        </ReceiveCardCell>
      </>
    );
  } else if (state === 'preparing') {
    receiveContent = (
      <ReceiveCardCell
        minHeight={320}
        alignItems="center"
        justifyContent="center"
        gap="$3"
      >
        <Spinner size="large" />
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.global_preparing })}
        </SizableText>
      </ReceiveCardCell>
    );
  } else if (state === 'error') {
    receiveContent = (
      <ReceiveCardCell
        minHeight={320}
        p="$5"
        alignItems="center"
        justifyContent="center"
        gap="$4"
      >
        <Icon name="ErrorOutline" size="$8" color="$iconSubdued" />
        <SizableText size="$bodyMd" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.privacy_error_setup_incomplete__msg,
          })}
        </SizableText>
        <Button variant="primary" onPress={resumePreview}>
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </ReceiveCardCell>
    );
  } else {
    receiveContent = (
      <ReceivePrivacySyncGate
        paused={state === 'stopped'}
        onEnable={() => {
          if (state === 'stopped') resumePreview();
          else openEnablePreview(true);
        }}
      />
    );
  }
  let receiveStatus: 'syncing' | 'synced' | 'waitingWifi' = 'syncing';
  if (state === 'synced') {
    receiveStatus = 'synced';
  } else if (mobileDataPaused) {
    receiveStatus = 'waitingWifi';
  }

  return (
    <YStack gap="$5">
      <YStack
        testID="privacy-token-preview-notice"
        bg="$bgCautionSubdued"
        p="$3"
        borderRadius="$3"
        gap="$1"
      >
        <SizableText size="$bodyMdMedium" color="$textCaution">
          Sample data · UI preview
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Controls change this preview only. No wallet is enabled or scanned.
        </SizableText>
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        {(['zec', 'xmr'] as const).map((item) => (
          <Button
            key={item}
            testID={`privacy-preview-chain-${item}`}
            size="small"
            variant={chain === item ? 'primary' : 'secondary'}
            onPress={() => {
              setChain(item);
              setSimulateSetup(false);
              setMobileDataPaused(false);
              setState('disabled');
            }}
          >
            {PREVIEW_NETWORKS[item].name}
          </Button>
        ))}
        <Button
          testID="privacy-preview-sync-start"
          size="small"
          variant="secondary"
          onPress={() => openEnablePreview(showReceive)}
        >
          {intl.formatMessage({
            id: ETranslations.privacy_sync_start__title,
          })}
        </Button>
        <Button
          testID="privacy-preview-receive"
          size="small"
          onPress={() => setShowReceive(!showReceive)}
        >
          {showReceive ? 'Token details' : 'Receive preview'}
        </Button>
      </XStack>

      <YStack gap="$3">
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <SizableText size="$bodySmMedium" color="$textSubdued" minWidth={100}>
            Wallet origin
          </SizableText>
          {(['existing', 'new'] as const).map((scenario) => (
            <Button
              key={scenario}
              testID={`privacy-preview-wallet-${scenario}`}
              size="small"
              variant={walletScenario === scenario ? 'primary' : 'tertiary'}
              onPress={() => setWalletScenario(scenario)}
            >
              {scenario === 'new' ? 'Created in OneKey' : 'Imported / unknown'}
            </Button>
          ))}
        </XStack>
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <SizableText size="$bodySmMedium" color="$textSubdued" minWidth={100}>
            Preview state
          </SizableText>
          {PREVIEW_STATES.map((item) => (
            <Button
              key={item.value}
              testID={`privacy-preview-state-${item.value}`}
              size="small"
              variant={state === item.value ? 'primary' : 'tertiary'}
              onPress={() => {
                setState(item.value);
                setSimulateSetup(false);
                setMobileDataPaused(false);
                if (item.value === 'disabled') {
                  setReceiveForms({ zec: 'public', xmr: 'private' });
                } else {
                  setReceiveForms((forms) => ({
                    ...forms,
                    [chain]: 'private',
                  }));
                }
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            testID="privacy-preview-waiting-wifi"
            size="small"
            variant={mobileDataPaused ? 'primary' : 'tertiary'}
            onPress={() => {
              setState('syncing');
              setSimulateSetup(false);
              setMobileDataPaused(true);
              setReceiveForms((forms) => ({ ...forms, [chain]: 'private' }));
            }}
          >
            Waiting for Wi-Fi
          </Button>
          <Button
            testID="privacy-preview-slots-full"
            size="small"
            variant={accountLimitReached ? 'primary' : 'tertiary'}
            onPress={() => setAccountLimitReached(!accountLimitReached)}
          >
            {accountLimitReached ? '5 / 5 accounts' : 'Account limit'}
          </Button>
        </XStack>
      </YStack>

      {showReceive ? (
        <YStack maxWidth={384} width="100%" alignSelf="center" gap="$5" py="$5">
          <ReceiveTitle
            title={`Receive ${network.symbol}`}
            logo={{
              uri: network.logoURI,
              symbol: network.symbol,
              before: 'Receive',
              after: '',
              hasGap: true,
            }}
          />
          <ReceiveCard
            testID="privacy-preview-receive-card"
            headerLeft={
              <XStack alignItems="center" gap="$2" flexShrink={0}>
                <Token size="xs" tokenImageUri={network.logoURI} />
                <SizableText size="$bodySmMedium">{network.name}</SizableText>
              </XStack>
            }
            headerRight={
              chain === 'zec' ? (
                <Select<'public' | 'private'>
                  title={intl.formatMessage({ id: ETranslations.address_type })}
                  value={receiveAddressForm}
                  disabled={state === 'preparing'}
                  items={[
                    {
                      label: intl.formatMessage({
                        id: ETranslations.privacy_balance_public__title,
                      }),
                      value: 'public',
                    },
                    {
                      label: intl.formatMessage({
                        id: ETranslations.private_send_private_option,
                      }),
                      value: 'private',
                    },
                  ]}
                  onChange={(next) => {
                    if (next === 'private' && state === 'disabled') {
                      openEnablePreview(true);
                    } else if (next === 'private' && state === 'stopped') {
                      resumePreview();
                    } else {
                      setReceiveForms((forms) => ({ ...forms, [chain]: next }));
                    }
                  }}
                  placement="bottom-end"
                  renderTrigger={({ onPress }) => (
                    <Button
                      testID="privacy-preview-address-type"
                      variant="tertiary"
                      size="small"
                      disabled={state === 'preparing'}
                      onPress={onPress}
                      iconAfter="ChevronDownSmallOutline"
                    >
                      {addressFormLabel}
                    </Button>
                  )}
                />
              ) : null
            }
          >
            {receiveContent}
          </ReceiveCard>
          {chain === 'zec' &&
          !isPrivateReceive &&
          (state === 'disabled' || state === 'stopped') ? (
            <ReceivePrivacyPromotion
              paused={state === 'stopped'}
              onEnable={() => {
                if (state === 'stopped') resumePreview();
                else openEnablePreview(true);
              }}
            />
          ) : null}
          {isPrivateReceive && receiveReady ? (
            <ReceivePrivacyStatus
              state={receiveStatus}
              onEnableMobileData={() => setMobileDataPaused(false)}
            />
          ) : null}
        </YStack>
      ) : (
        <YStack
          testID="privacy-token-details-preview"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$5"
          overflow="hidden"
          bg="$bgApp"
        >
          <XStack px="$5" py="$4" gap="$3" alignItems="center">
            <Token size="md" tokenImageUri={network.logoURI} />
            <SizableText size="$headingLg">{network.symbol}</SizableText>
            <Badge>{network.name}</Badge>
          </XStack>

          {chain === 'zec' ? (
            <Tabs.TabBar
              scrollable
              tabNames={PREVIEW_TABS}
              focusedTab={focusedTab}
              onTabPress={handleTabPress}
              renderItem={(itemProps, index) => (
                <Tabs.TabBarItem
                  {...itemProps}
                  testID={`privacy-preview-tab-${index === 0 ? 'transparent' : 'private'}`}
                />
              )}
            />
          ) : null}

          <YStack px="$5" pt="$5" pb="$6" gap="$5">
            {isPrivate && !isPrivateSynced ? (
              <TokenPrivacyPanel
                state={state}
                progress={
                  state === 'syncing' || state === 'stopped' ? 64 : undefined
                }
                detail={
                  state === 'error'
                    ? 'Unable to connect. Try again.'
                    : undefined
                }
                onEnable={() => openEnablePreview()}
                onSync={() => setState('syncing')}
              />
            ) : null}

            {!isPrivateSetup ? (
              <YStack>
                <TokenDetailsBalanceHero
                  isLoading={false}
                  currency="USD"
                  fiatValue={hasSampleBalance ? '42.00' : undefined}
                  balanceParsed={hasSampleBalance ? sampleBalance : undefined}
                  sync={
                    isPrivateSynced
                      ? {
                          isRefreshing,
                          lastSyncedAt,
                          onRefresh: () => setIsRefreshing(true),
                        }
                      : undefined
                  }
                />
                <RawActions flexWrap="wrap">
                  <RawActions.Send disabled />
                  <RawActions.Receive disabled />
                  <RawActions.Swap disabled />
                </RawActions>
              </YStack>
            ) : null}

            {!isPrivate ? (
              <YStack gap="$2">
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.global_my_address })}
                </SizableText>
                <SizableText size="$bodyMd">Sample address</SizableText>
              </YStack>
            ) : null}
          </YStack>

          {!isPrivateSetup ? (
            <>
              <Divider />
              <YStack py="$10" px="$5" alignItems="center" gap="$3">
                <Icon
                  name="ClockTimeHistoryOutline"
                  size="$10"
                  color="$iconSubdued"
                />
                <SizableText size="$headingMd">
                  {intl.formatMessage({
                    id: ETranslations.global_no_transactions_yet,
                  })}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  textAlign="center"
                  color="$textSubdued"
                >
                  Sample activity only
                </SizableText>
              </YStack>
            </>
          ) : null}
        </YStack>
      )}
    </YStack>
  );
}

export default function PrivacyTokenDetailsGallery() {
  const intl = useIntl();
  const [preview, setPreview] = useState<'token' | 'management'>('token');
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.preview__action })}
      />
      <Page.Body>
        <ScrollView contentContainerStyle={{ p: '$5' }}>
          <XStack gap="$2" pb="$5" flexWrap="wrap">
            <Button
              testID="privacy-preview-token-details"
              size="small"
              variant={preview === 'token' ? 'primary' : 'secondary'}
              onPress={() => setPreview('token')}
            >
              {intl.formatMessage({
                id: ETranslations.trade_stocks_token_details,
              })}
            </Button>
            <Button
              testID="privacy-preview-account-management"
              size="small"
              variant={preview === 'management' ? 'primary' : 'secondary'}
              onPress={() => setPreview('management')}
            >
              {intl.formatMessage({ id: ETranslations.global_manage_accounts })}
            </Button>
          </XStack>
          {preview === 'token' ? (
            <PrivacyTokenDetailsPreview />
          ) : (
            <PrivacyAccountManagementPreview />
          )}
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
