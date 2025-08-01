import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  type IPageScreenProps,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalBulkCopyAddressesRoutes,
  IModalBulkCopyAddressesParamList,
} from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import csvExporterUtils from '@onekeyhq/shared/src/utils/csvExporterUtils';

import { useAccountData } from '../../../hooks/useAccountData';

function ExportAddresses({
  route,
}: IPageScreenProps<
  IModalBulkCopyAddressesParamList,
  EModalBulkCopyAddressesRoutes.ExportAddressesModal
>) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { copyText } = useClipboard();
  const [isExporting, setIsExporting] = useState(false);

  const {
    networkAccountsByDeriveType,
    walletId,
    networkId,
    parentWalletName,
    exportWithoutDevice,
  } = route.params;

  const { wallet, network } = useAccountData({ walletId, networkId });

  const addressesData = useMemo(() => {
    const data: {
      type: 'address' | 'title' | 'blankLine';
      address?: string;
      accountName?: string;
      deriveType?: string;
      title?: string;
    }[] = [];

    const deriveTypes = Object.keys(networkAccountsByDeriveType);

    if (deriveTypes.length === 1) {
      const deriveType = deriveTypes[0];
      const networkAccounts = networkAccountsByDeriveType[deriveType];
      networkAccounts.forEach((item) => {
        data.push({
          type: 'address',
          address:
            item.account?.displayAddress ||
            item.account?.addressDetail?.displayAddress ||
            item.account?.address ||
            '',
          accountName: item.account?.name ?? '',
          deriveType: item.deriveInfo.labelKey
            ? intl.formatMessage({
                id: item.deriveInfo.labelKey,
              })
            : item.deriveInfo.label,
        });
      });
    } else if (deriveTypes.length > 1) {
      deriveTypes.forEach((deriveType) => {
        const networkAccounts = networkAccountsByDeriveType[deriveType];
        const networkAccount = networkAccounts[0];
        data.push({
          type: 'title',
          title: networkAccount.deriveInfo.labelKey
            ? intl.formatMessage({
                id: networkAccount.deriveInfo.labelKey,
              })
            : networkAccount.deriveInfo.label,
        });
        networkAccounts.forEach((item) => {
          data.push({
            type: 'address',
            address: item.account?.address ?? '',
            accountName: item.account?.name ?? '',
            deriveType: item.deriveInfo.labelKey
              ? intl.formatMessage({
                  id: item.deriveInfo.labelKey,
                })
              : item.deriveInfo.label,
          });
        });
        data.push({
          type: 'blankLine',
        });
      });
    }

    return data;
  }, [intl, networkAccountsByDeriveType]);

  const handleExportAddresses = useCallback(async () => {
    setIsExporting(true);

    const exportData = addressesData
      .filter((item) => item.type === 'address')
      .map((item) => ({
        'Account name': item.accountName,
        [`${network?.name ?? ''} address`]: item.address,
        'Derivation path': item.deriveType,
      }));

    const filename = parentWalletName
      ? `${parentWalletName}_${wallet?.name ?? ''}_${
          network?.name ?? ''
        }_addresses_${new Date().getTime()}.csv`
      : `${wallet?.name ?? ''}_${
          network?.name ?? ''
        }_addresses_${new Date().getTime()}.csv`;

    await csvExporterUtils.exportCSV(exportData, filename);
    setIsExporting(false);
  }, [addressesData, network?.name, parentWalletName, wallet?.name]);
  const handleCopyAddresses = useCallback(() => {
    copyText(
      addressesData
        .filter((item) => item.type === 'address')
        .map((item) => item.address?.trim() || '')
        .filter((address) => address)
        .join('\n'),
      ETranslations.global_bulk_copy_addresses_addresses_copied,
    );
  }, [addressesData, copyText]);

  const renderAddresses = useCallback(() => {
    return (
      <ScrollView
        width="100%"
        height="100%"
        p="$2.5"
        borderRadius="$2"
        borderCurve="continuous"
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderStrong"
      >
        <Stack>
          <YStack gap="$1" pb="$5" userSelect="none">
            {addressesData.map((item, index) => {
              return (
                <XStack key={index} alignItems="flex-start">
                  <Stack width={32} justifyContent="flex-start">
                    <SizableText
                      size="$bodyLgMedium"
                      color="$textDisabled"
                      numberOfLines={1}
                    >
                      {index + 1}
                    </SizableText>
                  </Stack>
                  <Stack flex={1} mr="$0.5">
                    {item.type === 'address' ? (
                      <SizableText
                        size="$bodyLg"
                        color="$transparent"
                        style={{
                          wordBreak: 'break-all',
                        }}
                      >
                        {item.address}
                      </SizableText>
                    ) : null}
                    {item.type === 'title' ? (
                      <SizableText size="$bodyLg" color="$transparent">
                        {`// ${item.title ?? ''}`}
                      </SizableText>
                    ) : null}
                    {item.type === 'blankLine' ? (
                      <SizableText size="$bodyLg" />
                    ) : null}
                  </Stack>
                </XStack>
              );
            })}
          </YStack>
          <YStack
            gap="$1"
            pb="$5"
            position="absolute"
            top={0}
            left={0}
            zIndex={1000}
            w="100%"
            userSelect="none"
          >
            {addressesData.map((item, index) => {
              return (
                <XStack key={index} alignItems="flex-start">
                  <Stack width={32} height={24} />
                  <Stack flex={1} mr="$0.5">
                    {item.type === 'address' ? (
                      <SizableText
                        size="$bodyLg"
                        userSelect="text"
                        style={{
                          wordBreak: 'break-all',
                        }}
                      >
                        {item.address}
                      </SizableText>
                    ) : null}
                    {item.type === 'title' ? (
                      <SizableText
                        size="$bodyLg"
                        color="$textDisabled"
                        userSelect="text"
                      >
                        {`// ${item.title ?? ''}`}
                      </SizableText>
                    ) : null}
                    {item.type === 'blankLine' ? (
                      <SizableText size="$bodyLg" />
                    ) : null}
                  </Stack>
                </XStack>
              );
            })}
          </YStack>
        </Stack>
      </ScrollView>
    );
  }, [addressesData]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_export_addresses,
        })}
      />
      <Page.Body p="$5">
        {accountUtils.isHwWallet({ walletId: walletId ?? '' }) &&
        exportWithoutDevice ? (
          <XStack mb="$3">
            <Badge badgeSize="sm" badgeType="critical">
              <Badge.Text>
                {intl.formatMessage({
                  id: ETranslations.receive_address_unconfirmed_alert_message,
                })}
              </Badge.Text>
            </Badge>
          </XStack>
        ) : null}
        {renderAddresses()}
      </Page.Body>
      <Page.Footer>
        <XStack
          p="$5"
          gap="$2.5"
          $gtMd={{
            ml: 'auto',
          }}
        >
          <Button
            variant="secondary"
            onPress={handleCopyAddresses}
            size={gtMd ? 'medium' : 'large'}
            $md={
              {
                flexGrow: 1,
                flexBasis: 0,
                size: 'large',
              } as any
            }
          >
            {intl.formatMessage({
              id: ETranslations.global_copy,
            })}
          </Button>
          <Button
            variant="primary"
            onPress={handleExportAddresses}
            size={gtMd ? 'medium' : 'large'}
            loading={isExporting}
            disabled={isExporting}
            $md={
              {
                flexGrow: 1,
                flexBasis: 0,
                size: 'large',
              } as any
            }
          >
            {intl.formatMessage({
              id: ETranslations.global_bulk_copy_addresses_export_csv,
            })}
          </Button>
        </XStack>
      </Page.Footer>
    </Page>
  );
}

export default ExportAddresses;
