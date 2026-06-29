import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Icon,
  Page,
  ScrollView,
  Select,
  SizableText,
  Spinner,
  Stack,
  TextArea,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { queryAddressWithFallback } from '@onekeyhq/kit/src/components/AddressInput/utils';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAddressRiskCheckRoutes,
  type IModalAddressRiskCheckParamList,
} from '@onekeyhq/shared/src/routes/addressRiskCheck';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAddressRiskCheckRecentItem } from '@onekeyhq/shared/types/addressRiskCheck';

import useConfigurableChainSelector from '../../ChainSelector/hooks/useChainSelector';
import { RecentCheckItem } from '../components/RecentCheckItem';
import { useCheckAddressRisk } from '../hooks/useCheckAddressRisk';
import { useRecentChecks } from '../hooks/useRecentChecks';
import { getAddressRiskCheckInputState } from '../utils/addressRiskCheckInputUtils';

import type { RouteProp } from '@react-navigation/core';

function AddressRiskCheckInput() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const openChainSelector = useConfigurableChainSelector();
  const { getClipboard } = useClipboard();
  const { isChecking, checkRisk } = useCheckAddressRisk();
  const { items: recentChecks, networkNameMap } = useRecentChecks({ limit: 3 });

  const route =
    useRoute<
      RouteProp<
        IModalAddressRiskCheckParamList,
        EModalAddressRiskCheckRoutes.AddressRiskCheckInput
      >
    >();
  const activeNetworkId = route.params?.networkId;

  const [selectedNetwork, setSelectedNetwork] = useState<
    { id: string; name: string } | undefined
  >();
  const [address, setAddress] = useState('');
  const [selectedResolvedAddress, setSelectedResolvedAddress] = useState<
    string | undefined
  >();

  const networkId = selectedNetwork?.id;
  const trimmedAddress = address.trim();
  const debouncedAddress = useDebounce(trimmedAddress, 400);

  const {
    result: supportedNetworks,
    isLoading: isLoadingNetworks,
    run: reloadSupportedNetworks,
  } = usePromiseResult(
    () => backgroundApiProxy.serviceAddressRiskCheck.apiGetSupportedNetworks(),
    [],
    { initResult: [], watchLoading: true },
  );

  const supportedNetworkIds = useMemo(
    () => supportedNetworks.map((n) => n.networkId),
    [supportedNetworks],
  );

  const queryKey =
    networkId && debouncedAddress ? `${networkId}:${debouncedAddress}` : '';

  const { result: addressQuery, isLoading: isQueryingAddress } =
    usePromiseResult(
      async () => {
        if (!networkId || !debouncedAddress) {
          return { key: '', result: undefined };
        }
        const result = await queryAddressWithFallback({
          networkId,
          address: debouncedAddress,
          enableNameResolve: true,
        });
        return { key: `${networkId}:${debouncedAddress}`, result };
      },
      [networkId, debouncedAddress],
      { initResult: { key: '', result: undefined }, watchLoading: true },
    );

  const isPendingValidation = trimmedAddress !== debouncedAddress;
  const currentAddressQuery =
    addressQuery.key === queryKey ? addressQuery.result : undefined;
  const addressState = useMemo(
    () =>
      getAddressRiskCheckInputState({
        rawAddress: trimmedAddress,
        query: currentAddressQuery,
        selectedResolvedAddress,
      }),
    [currentAddressQuery, selectedResolvedAddress, trimmedAddress],
  );
  const isAddressInvalid =
    Boolean(trimmedAddress) &&
    !isPendingValidation &&
    !isQueryingAddress &&
    addressState.isInvalid;
  const canCheck =
    Boolean(networkId) &&
    Boolean(trimmedAddress) &&
    !isPendingValidation &&
    !isQueryingAddress &&
    Boolean(addressState.checkAddress);

  useEffect(() => {
    setSelectedResolvedAddress(undefined);
  }, [queryKey]);

  // Pre-select the active network once, if it is supported.
  const didPreselectRef = useRef(false);
  useEffect(() => {
    if (
      didPreselectRef.current ||
      !activeNetworkId ||
      !supportedNetworks.length
    ) {
      return;
    }
    const matched = supportedNetworks.find(
      (n) => n.networkId === activeNetworkId,
    );
    if (matched) {
      didPreselectRef.current = true;
      setSelectedNetwork({ id: matched.networkId, name: matched.networkName });
    }
  }, [activeNetworkId, supportedNetworks]);

  const handleSelectNetwork = useCallback(() => {
    // Never fall back to "all networks" when the supported list isn't ready —
    // that would let the user pick an unsupported network and only fail later at
    // the check call. Retry a failed/empty load instead of opening the selector.
    if (!supportedNetworkIds.length) {
      if (!isLoadingNetworks) {
        void reloadSupportedNetworks();
      }
      return;
    }
    openChainSelector({
      networkIds: supportedNetworkIds,
      // Only group networks once the list grows beyond 10; a short list reads
      // better as a flat list.
      grouped: supportedNetworkIds.length > 10,
      defaultNetworkId: selectedNetwork?.id,
      onSelect: (network) => {
        setSelectedNetwork({ id: network.id, name: network.name });
      },
    });
  }, [
    openChainSelector,
    supportedNetworkIds,
    selectedNetwork?.id,
    isLoadingNetworks,
    reloadSupportedNetworks,
  ]);

  const handlePaste = useCallback(async () => {
    const text = await getClipboard();
    if (text) {
      setAddress(text);
    }
  }, [getClipboard]);

  const handleOpenHistory = useCallback(() => {
    navigation.push(EModalAddressRiskCheckRoutes.AddressRiskCheckHistory);
  }, [navigation]);

  const handleRecentPress = useCallback(
    (item: IAddressRiskCheckRecentItem) => {
      void checkRisk({
        networkId: item.networkId,
        address: item.address,
        entryPoint: 'inputRecentList',
      });
    },
    [checkRisk],
  );

  const handleCheck = useCallback(() => {
    if (!networkId || !canCheck) {
      return;
    }
    void checkRisk({
      networkId,
      address: addressState.checkAddress ?? trimmedAddress,
      entryPoint: 'inputManual',
    });
  }, [
    networkId,
    canCheck,
    addressState.checkAddress,
    trimmedAddress,
    checkRisk,
  ]);

  const headerRight = useCallback(
    () => (
      <HeaderIconButton
        icon="ClockTimeHistoryOutline"
        onPress={handleOpenHistory}
      />
    ),
    [handleOpenHistory],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_risk_check__title,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <ScrollView>
          <YStack px="$5" py="$4" gap="$5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.address_risk_check_intro__desc,
              })}
            </SizableText>

            <YStack gap="$1.5">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({ id: ETranslations.global_network })}
              </SizableText>
              <XStack
                role="button"
                alignItems="center"
                minHeight={46}
                borderWidth={1}
                borderColor="$borderStrong"
                borderRadius="$3"
                overflow="hidden"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                onPress={handleSelectNetwork}
              >
                <Stack pl="$3">
                  {selectedNetwork ? (
                    <NetworkAvatar networkId={selectedNetwork.id} size="$7" />
                  ) : (
                    <Icon name="GlobusOutline" size="$7" color="$iconSubdued" />
                  )}
                </Stack>
                <SizableText
                  flex={1}
                  px="$3.5"
                  py="$2.5"
                  size="$bodyLg"
                  color={selectedNetwork ? '$text' : '$textSubdued'}
                  numberOfLines={1}
                >
                  {selectedNetwork
                    ? selectedNetwork.name
                    : intl.formatMessage({
                        id: ETranslations.global_select_network,
                      })}
                </SizableText>
                <Stack px="$2.5">
                  {isLoadingNetworks && !supportedNetworkIds.length ? (
                    <Spinner size="small" />
                  ) : (
                    <Icon
                      name="ChevronGrabberVerOutline"
                      size="$6"
                      color="$iconSubdued"
                    />
                  )}
                </Stack>
              </XStack>
            </YStack>

            <YStack gap="$1.5">
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({ id: ETranslations.global_address })}
              </SizableText>
              <Stack>
                <TextArea
                  testID="address-risk-check-address-input"
                  value={address}
                  onChangeText={setAddress}
                  placeholder={intl.formatMessage({
                    id: ETranslations.wallet_track_any_address_placeholder,
                  })}
                  error={isAddressInvalid}
                  numberOfLines={3}
                  pb="$12"
                />
                <Button
                  testID="address-risk-check-paste"
                  position="absolute"
                  bottom="$3"
                  right="$3"
                  size="small"
                  variant="secondary"
                  icon="Copy3Outline"
                  onPress={handlePaste}
                >
                  {intl.formatMessage({ id: ETranslations.menu_paste })}
                </Button>
              </Stack>
              {isAddressInvalid ? (
                <SizableText size="$bodyMd" color="$textCritical">
                  {intl.formatMessage({
                    id: ETranslations.form_address_error_invalid,
                  })}
                </SizableText>
              ) : null}
              {!isAddressInvalid &&
              !isPendingValidation &&
              !isQueryingAddress &&
              addressState.resolvedOptions.length ? (
                <XStack gap="$2" ai="center" flexWrap="wrap">
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.address_risk_check_resolved_address__title,
                    })}
                  </SizableText>
                  {addressState.resolvedOptions.length > 1 ? (
                    <Select
                      testID="address-risk-check-resolved-address-select"
                      title={intl.formatMessage({
                        id: ETranslations.send_ens_choose_address_title,
                      })}
                      placeholder={intl.formatMessage({
                        id: ETranslations.send_ens_choose_address_title,
                      })}
                      renderTrigger={({ label, placeholder }) => (
                        <Badge badgeSize="sm" userSelect="none">
                          <Badge.Text>{label || placeholder}</Badge.Text>
                          <Icon
                            name="ChevronDownSmallOutline"
                            color="$iconSubdued"
                            size="$4"
                          />
                        </Badge>
                      )}
                      items={addressState.resolvedOptions.map((option) => ({
                        label: accountUtils.shortenAddress({ address: option }),
                        value: option,
                        description: option,
                      }))}
                      value={selectedResolvedAddress}
                      onChange={(value) => setSelectedResolvedAddress(value)}
                      floatingPanelProps={{
                        width: '$80',
                      }}
                    />
                  ) : (
                    <Badge badgeSize="sm">
                      <Badge.Text>
                        {accountUtils.shortenAddress({
                          address: addressState.resolvedOptions[0] ?? '',
                        })}
                      </Badge.Text>
                    </Badge>
                  )}
                </XStack>
              ) : null}
            </YStack>
          </YStack>

          {recentChecks.length ? (
            <YStack pb="$4">
              <XStack px="$5" py="$2" ai="center" jc="space-between">
                <SizableText size="$headingSm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.address_risk_check_recent_checks__title,
                  })}
                </SizableText>
                <SizableText
                  size="$bodyMdMedium"
                  color="$textSubdued"
                  cursor="default"
                  userSelect="none"
                  onPress={handleOpenHistory}
                >
                  {intl.formatMessage({ id: ETranslations.global_history })}
                </SizableText>
              </XStack>
              {recentChecks.map((item) => (
                <RecentCheckItem
                  key={`${item.networkId}_${item.address}`}
                  item={item}
                  networkName={networkNameMap[item.networkId]}
                  onPress={handleRecentPress}
                />
              ))}
            </YStack>
          ) : null}
        </ScrollView>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.address_risk_check_check_risk__action,
        })}
        confirmButtonProps={{ loading: isChecking, disabled: !canCheck }}
        onConfirm={handleCheck}
      />
    </Page>
  );
}

export default AddressRiskCheckInput;
