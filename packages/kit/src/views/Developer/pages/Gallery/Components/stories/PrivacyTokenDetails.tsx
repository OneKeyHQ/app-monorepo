import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Divider,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import TokenDetailsBalanceHero from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsBalanceHero';
import { TokenPrivacyPanel } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenPrivacyPanel';
import type { ITokenPrivacyPanelState } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/TokenPrivacyPanel';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

const PREVIEW_TABS = ['Transparent', 'Private'];

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
  const [lastSyncedAt, setLastSyncedAt] = useState(() =>
    new Date(2026, 9, 27, 14, 17, 28).getTime(),
  );

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

      <XStack gap="$2">
        {(['zec', 'xmr'] as const).map((item) => (
          <Button
            key={item}
            testID={`privacy-preview-chain-${item}`}
            size="small"
            variant={chain === item ? 'primary' : 'secondary'}
            onPress={() => setChain(item)}
          >
            {PREVIEW_NETWORKS[item].name}
          </Button>
        ))}
      </XStack>

      {isPrivate ? (
        <YStack gap="$2">
          <SizableText size="$bodySmMedium" color="$textSubdued">
            Preview state
          </SizableText>
          <XStack gap="$2" flexWrap="wrap">
            {PREVIEW_STATES.map((item) => (
              <Button
                key={item.value}
                testID={`privacy-preview-state-${item.value}`}
                size="small"
                variant={state === item.value ? 'primary' : 'tertiary'}
                onPress={() => setState(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </XStack>
        </YStack>
      ) : null}

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
              title={
                chain === 'xmr' && state === 'disabled'
                  ? 'Enable syncing'
                  : undefined
              }
              description={
                chain === 'xmr' && state === 'disabled'
                  ? 'Sync to discover your Monero balance and activity.'
                  : undefined
              }
              progress={
                state === 'syncing' || state === 'stopped' ? 64 : undefined
              }
              detail={
                state === 'error' ? 'Unable to connect. Try again.' : undefined
              }
              onEnable={() => setState('preparing')}
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
              <SizableText size="$bodyMd">
                Sample transparent address
              </SizableText>
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
    </YStack>
  );
}

export default function PrivacyTokenDetailsGallery() {
  return (
    <Page>
      <Page.Header title="Privacy token details · UI preview" />
      <Page.Body>
        <ScrollView contentContainerStyle={{ p: '$5' }}>
          <PrivacyTokenDetailsPreview />
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
