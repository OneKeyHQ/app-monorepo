import { useEffect } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Divider,
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { buildAddressMapInfoKey } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  TX_RISKY_LEVEL_MALICIOUS,
  TX_RISKY_LEVEL_SCAM,
  TX_RISKY_LEVEL_SPAM,
} from '@onekeyhq/shared/src/walletConnect/constant';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../hooks/useAccountData';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { useAddressesInfoAtom } from '../../states/jotai/contexts/historyList';
import {
  InfoItem,
  InfoItemGroup,
} from '../../views/AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import { NetworkAvatar } from '../NetworkAvatar';
import { Token } from '../Token';
import TxHistoryAddressInfo from '../TxHistoryListView/TxHistoryAddressInfo';

import type {
  ITxActionCommonDetailViewProps,
  ITxActionCommonListViewProps,
} from './types';

function TxActionCommonAvatar({
  avatar,
  networkLogoURI,
  compact,
  tableLayout,
  networkId,
}: Pick<
  ITxActionCommonListViewProps,
  'avatar' | 'tableLayout' | 'networkLogoURI' | 'compact' | 'networkId'
>) {
  const containerSize = compact ? '$8' : '$10';

  const {
    activeAccount: { network: activeNetwork },
  } = useActiveAccount({ num: 0 });

  if (tableLayout) {
    const showNetworkBadge = activeNetwork?.isAllNetworks;
    return (
      <Stack position="relative" w="$10" h="$10">
        <Stack
          w="$10"
          h="$10"
          borderColor="$gray3"
          bg="$gray2"
          borderWidth={StyleSheet.hairlineWidth}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
        >
          <Icon
            name={avatar.fallbackIcon ?? 'Document2Outline'}
            color="$icon"
            size="$6"
          />
        </Stack>
        {showNetworkBadge ? (
          <Stack
            position="absolute"
            right="$-1"
            bottom="$-0.5"
            p="$0.5"
            bg="$bgApp"
            borderRadius="$full"
          >
            <NetworkAvatar networkId={networkId} size="$4" />
          </Stack>
        ) : null}
      </Stack>
    );
  }

  if (!avatar.src || typeof avatar.src === 'string') {
    return (
      <Token
        size={compact ? 'md' : 'lg'}
        isNFT={avatar.isNFT}
        fallbackIcon={avatar.fallbackIcon}
        tokenImageUri={avatar.src}
        networkImageUri={
          activeNetwork?.isAllNetworks ? networkLogoURI : undefined
        }
        networkId={activeNetwork?.id}
        showNetworkIcon={activeNetwork?.isAllNetworks}
      />
    );
  }

  return (
    <Stack
      w={containerSize}
      h={containerSize}
      alignItems="flex-end"
      justifyContent="flex-end"
    >
      <Stack position="absolute" left="$0" top="$0">
        <Token
          size="sm"
          isNFT={avatar.isNFT}
          fallbackIcon={avatar.fallbackIcon}
          tokenImageUri={avatar.src[0]}
          networkImageUri={
            activeNetwork?.isAllNetworks ? networkLogoURI : undefined
          }
          showNetworkIcon={activeNetwork?.isAllNetworks}
          networkId={activeNetwork?.id}
        />
      </Stack>
      <Stack
        borderWidth={2}
        borderColor="$bgApp"
        borderRadius="$full"
        zIndex={1}
      >
        <Token
          size="sm"
          isNFT={avatar.isNFT}
          fallbackIcon={avatar.fallbackIcon}
          tokenImageUri={avatar.src[1]}
          networkImageUri={
            activeNetwork?.isAllNetworks ? networkLogoURI : undefined
          }
          showNetworkIcon={activeNetwork?.isAllNetworks}
          networkId={activeNetwork?.id}
        />
      </Stack>
    </Stack>
  );
}

function TxActionCommonTitle({
  title,
  tableLayout,
  replaceType,
  status,
  riskyLevel,
  kytRiskLevel,
  compact: _compact,
}: Pick<
  ITxActionCommonListViewProps,
  | 'title'
  | 'tableLayout'
  | 'replaceType'
  | 'status'
  | 'riskyLevel'
  | 'kytRiskLevel'
  | 'compact'
>) {
  const intl = useIntl();

  return (
    <XStack alignItems="center" minWidth={0}>
      <SizableText
        numberOfLines={1}
        flexShrink={1}
        size={tableLayout ? '$bodyMdMedium' : '$bodyLgMedium'}
      >
        {title}
      </SizableText>
      {replaceType && status === EDecodedTxStatus.Pending ? (
        <Badge badgeSize="sm" badgeType="info" ml="$2">
          {intl.formatMessage({
            id:
              replaceType === EReplaceTxType.SpeedUp
                ? ETranslations.global_sped_up
                : ETranslations.global_cancelling,
          })}
        </Badge>
      ) : null}
      {status === EDecodedTxStatus.Failed ? (
        <Badge badgeSize="sm" badgeType="critical" ml="$2">
          {intl.formatMessage({ id: ETranslations.global_failed })}
        </Badge>
      ) : null}
      {riskyLevel && riskyLevel === TX_RISKY_LEVEL_SPAM ? (
        <Badge badgeSize="sm" badgeType="default" ml="$2">
          {intl.formatMessage({ id: ETranslations.global_spam })}
        </Badge>
      ) : null}
      {riskyLevel && riskyLevel === TX_RISKY_LEVEL_MALICIOUS ? (
        <Badge badgeSize="sm" badgeType="warning" ml="$2">
          {intl.formatMessage({ id: ETranslations.global_malicious })}
        </Badge>
      ) : null}
      {riskyLevel && riskyLevel === TX_RISKY_LEVEL_SCAM ? (
        <Badge badgeSize="sm" badgeType="critical" ml="$2">
          {intl.formatMessage({ id: ETranslations.global_scam })}
        </Badge>
      ) : null}
      {kytRiskLevel === EKytRiskLevel.Severe ? (
        <Badge badgeSize="sm" badgeType="critical" ml="$2">
          {intl.formatMessage({ id: ETranslations.kyt_severe_risk__title })}
        </Badge>
      ) : null}
      {kytRiskLevel === EKytRiskLevel.High ? (
        <Badge badgeSize="sm" badgeType="warning" ml="$2">
          {intl.formatMessage({ id: ETranslations.kyt_high_risk__title })}
        </Badge>
      ) : null}
    </XStack>
  );
}

function TxActionCommonDescription({
  networkId,
  description,
}: Pick<ITxActionCommonListViewProps, 'description' | 'tableLayout'> & {
  networkId: string;
}) {
  const [addressesInfo] = useAddressesInfoAtom();

  const { result: addressLocalLabel, run } = usePromiseResult(async () => {
    if (!description?.originalAddress) {
      return null;
    }

    const result = await backgroundApiProxy.serviceAccountProfile.queryAddress({
      networkId,
      address: description?.originalAddress,
      enableAddressBook: true,
      enableWalletName: true,
      skipValidateAddress: true,
    });

    return result.addressBookName || result.walletAccountName;
  }, [description?.originalAddress, networkId]);

  useEffect(() => {
    const refresh = async () => {
      await backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
      await run({ alwaysSetState: true });
    };

    appEventBus.on(EAppEventBusNames.WalletUpdate, refresh);
    appEventBus.on(EAppEventBusNames.AccountUpdate, refresh);
    appEventBus.on(EAppEventBusNames.AddressBookUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, refresh);
      appEventBus.off(EAppEventBusNames.AccountUpdate, refresh);
      appEventBus.off(EAppEventBusNames.AddressBookUpdate, refresh);
    };
  }, [run]);

  if (description?.originalAddress) {
    const addressInfoKey = buildAddressMapInfoKey({
      networkId,
      address: description?.originalAddress,
    });
    if (addressesInfo[addressInfoKey]) {
      return (
        <Stack flexShrink={1} minWidth={0}>
          <TxHistoryAddressInfo
            address={description.originalAddress}
            badge={addressesInfo[addressInfoKey]}
          />
        </Stack>
      );
    }
  }

  return (
    <XStack alignItems="center" flex={1} flexShrink={1} minWidth={0}>
      {description?.prefix ? (
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          pr="$1.5"
          flexShrink={0}
        >
          {description?.prefix}
        </SizableText>
      ) : null}
      {description?.icon ? (
        <Icon
          color="$iconSubdued"
          mr="$0.5"
          size="$4"
          name={description.icon}
        />
      ) : null}
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        flex={1}
        flexShrink={1}
        minWidth={0}
        numberOfLines={1}
      >
        {addressLocalLabel || description?.children}
      </SizableText>
    </XStack>
  );
}

function TxActionCommonChange({
  change,
  tableLayout,
  compact: _compact,
}: Pick<ITxActionCommonListViewProps, 'tableLayout' | 'compact'> & {
  change: string;
}) {
  return (
    <SizableText
      minWidth={0}
      numberOfLines={1}
      size="$bodyLgMedium"
      {...(!tableLayout && {
        textAlign: 'right',
      })}
      {...(change?.includes('+') && {
        color: '$textSuccess',
      })}
    >
      {change}
    </SizableText>
  );
}

function TxActionCommonChangeDescription({
  changeDescription,
  tableLayout,
}: {
  changeDescription: string;
  tableLayout?: boolean;
}) {
  return (
    <SizableText
      size="$bodyMd"
      color="$textSubdued"
      numberOfLines={1}
      minWidth={0}
      {...(!tableLayout && {
        textAlign: 'right',
      })}
    >
      {changeDescription || '-'}
    </SizableText>
  );
}

function TxActionCommonFee({
  fee,
  feeFiatValue,
  feeSymbol,
  currencySymbol,
  tableLayout,
  hideFeeInfo,
}: Pick<
  ITxActionCommonListViewProps,
  'fee' | 'feeFiatValue' | 'feeSymbol' | 'tableLayout' | 'hideFeeInfo'
> & {
  currencySymbol: string;
}) {
  const intl = useIntl();

  if (!tableLayout) {
    return null;
  }

  return (
    <Stack flexGrow={0.6} flexBasis={0} opacity={hideFeeInfo ? 0 : 1} gap="$1">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.swap_history_detail_network_fee,
        })}
      </SizableText>
      <XStack alignItems="center" gap="$1">
        <NumberSizeableText
          size="$bodyMd"
          formatter="balance"
          formatterOptions={{ tokenSymbol: feeSymbol }}
          numberOfLines={1}
          flexShrink={1}
          minWidth={0}
        >
          {fee}
        </NumberSizeableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          numberOfLines={1}
          flexShrink={1}
          minWidth={0}
        >
          {feeFiatValue}
        </NumberSizeableText>
      </XStack>
    </Stack>
  );
}

function TxActionCommonListView(
  props: ITxActionCommonListViewProps & IListItemProps,
) {
  const {
    avatar,
    title,
    status,
    description,
    change,
    changeDescription,
    fee,
    feeFiatValue,
    feeSymbol,
    timestamp,
    tableLayout,
    showIcon,
    hideFeeInfo,
    replaceType,
    networkId,
    networkLogoURI,
    riskyLevel,
    kytRiskLevel,
    compact,
    ...rest
  } = props;
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  let changeMaxWidth: '50%' | '65%' = '50%';
  if (!tableLayout && platformEnv.isNativeAndroid) {
    changeMaxWidth = '65%';
  }

  return (
    <ListItem
      testID="tx-action-common-list-view"
      gap="$2"
      flexDirection="column"
      alignItems="flex-start"
      userSelect="none"
      opacity={
        riskyLevel &&
        (riskyLevel === TX_RISKY_LEVEL_MALICIOUS ||
          riskyLevel === TX_RISKY_LEVEL_SCAM)
          ? 0.5
          : 1
      }
      {...(tableLayout && { py: '$3' })}
      {...rest}
    >
      {/* Content */}
      <XStack gap="$3" alignSelf="stretch">
        {/* token, title and subtitle */}
        <XStack
          flex={1}
          minWidth={0}
          gap="$3"
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
          })}
          alignItems="center"
        >
          {showIcon ? (
            <TxActionCommonAvatar
              avatar={avatar}
              tableLayout={tableLayout}
              networkLogoURI={networkLogoURI}
              compact={compact}
              networkId={networkId}
            />
          ) : null}
          <Stack flex={1} minWidth={0} {...(tableLayout && { gap: '$1' })}>
            <TxActionCommonTitle
              title={title}
              status={status}
              tableLayout={tableLayout}
              replaceType={replaceType}
              riskyLevel={riskyLevel}
              kytRiskLevel={kytRiskLevel}
              compact={compact}
            />
            <XStack alignSelf="stretch" minWidth={0}>
              {timestamp &&
              (tableLayout || !(description && description.children)) ? (
                <>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {formatTime(new Date(timestamp), {
                      hideSeconds: true,
                      hideMilliseconds: true,
                    })}
                  </SizableText>
                  {description && description.children ? (
                    <SizableText size="$bodyMd" color="$textSubdued" mx="$1">
                      •
                    </SizableText>
                  ) : null}
                </>
              ) : null}
              <TxActionCommonDescription
                networkId={networkId}
                description={description}
                tableLayout={tableLayout}
              />
            </XStack>
          </Stack>
        </XStack>
        {/* changes */}
        <Stack
          minWidth={0}
          maxWidth={changeMaxWidth}
          alignItems="flex-end"
          {...(!tableLayout && {
            flexShrink: 0,
          })}
          {...(tableLayout && {
            alignItems: 'unset',
            flexGrow: 1,
            flexBasis: 0,
            gap: '$1',
          })}
        >
          {typeof change === 'string' ? (
            <TxActionCommonChange
              change={change}
              tableLayout={tableLayout}
              compact={compact}
            />
          ) : (
            change
          )}
          {typeof changeDescription === 'string' ? (
            <TxActionCommonChangeDescription
              changeDescription={changeDescription}
              tableLayout={tableLayout}
            />
          ) : (
            changeDescription
          )}
        </Stack>
        {/* fees */}
        <TxActionCommonFee
          tableLayout={tableLayout}
          hideFeeInfo={hideFeeInfo}
          fee={fee}
          feeFiatValue={feeFiatValue}
          feeSymbol={feeSymbol}
          currencySymbol={currencySymbol}
        />
      </XStack>
    </ListItem>
  );
}

function TxActionCommonDetailView(props: ITxActionCommonDetailViewProps) {
  const { overview, target, source, applyFor, networkId } = props;
  const intl = useIntl();
  const { network } = useAccountData({ networkId });

  return (
    <InfoItemGroup>
      <InfoItem
        label={overview.title}
        renderContent={
          <XStack alignItems="center" gap="$3" minWidth={0}>
            <Token
              fallbackIcon={overview.avatar?.fallbackIcon}
              isNFT={overview.avatar?.isNFT}
              tokenImageUri={overview.avatar?.src}
            />
            {typeof overview.content === 'string' ? (
              <SizableText
                minWidth={0}
                maxWidth="$96"
                size="$headingSm"
                flex={1}
              >
                {overview.content}
              </SizableText>
            ) : (
              overview.content
            )}
          </XStack>
        }
      />

      <Divider mx="$2.5" my="$3" />

      {source && source.content ? (
        <InfoItem
          label={
            source.title ??
            intl.formatMessage({ id: ETranslations.content__from })
          }
          renderContent={source.content}
          description={source.description?.content}
        />
      ) : null}

      {target && target.content ? (
        <InfoItem
          label={
            target.title ??
            intl.formatMessage({ id: ETranslations.content__to })
          }
          renderContent={target.content}
          description={target.description?.content}
        />
      ) : null}

      {applyFor && applyFor.content ? (
        <InfoItem
          label={
            applyFor.title ??
            intl.formatMessage({ id: ETranslations.global_for })
          }
          renderContent={applyFor.content}
          description={applyFor.description?.content}
        />
      ) : null}
      <InfoItem
        label={intl.formatMessage({ id: ETranslations.network__network })}
        renderContent={
          <XStack alignItems="center" gap="$2">
            <NetworkAvatar networkId={networkId} size="$5" />
            <SizableText size="$bodyMd" color="$textSubdued">
              {network?.name}
            </SizableText>
          </XStack>
        }
      />
    </InfoItemGroup>
  );
}

export { TxActionCommonListView, TxActionCommonDetailView };
