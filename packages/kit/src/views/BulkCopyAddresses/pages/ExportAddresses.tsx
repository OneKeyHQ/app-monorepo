import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
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

  const { networkAccountsByDeriveType, walletId, networkId, parentWalletName } =
    route.params;

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
          address: item.account?.address ?? '',
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
        <YStack gap="$1">
          {addressesData.map((item, index) => {
            return (
              <XStack key={index} alignItems="flex-start">
                <Stack width={32} justifyContent="flex-start" userSelect="none">
                  <SizableText
                    size="$bodyLgMedium"
                    color="$textDisabled"
                    numberOfLines={1}
                    userSelect="none"
                    style={{
                      userSelect: 'none',
                    }}
                  >
                    {index + 1}
                  </SizableText>
                </Stack>
                <Stack flex={1} mr="$0.5">
                  {item.type === 'address' ? (
                    <SizableText
                      size="$bodyLg"
                      style={{
                        wordBreak: 'break-all',
                        userSelect: 'text',
                      }}
                    >
                      {item.address}
                    </SizableText>
                  ) : null}
                  {item.type === 'title' ? (
                    <SizableText size="$bodyLg" color="$textDisabled">
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
      <Page.Body p="$5">{renderAddresses()}</Page.Body>
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
              id: ETranslations.global_export,
            })}
          </Button>
        </XStack>
      </Page.Footer>
    </Page>
  );
}

export default ExportAddresses;
