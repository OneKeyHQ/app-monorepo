import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  type IPageScreenProps,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalBulkCopyAddressesRoutes,
  IModalBulkCopyAddressesParamList,
} from '@onekeyhq/shared/src/routes/bulkCopyAddresses';

function ExportAddresses({
  route,
}: IPageScreenProps<
  IModalBulkCopyAddressesParamList,
  EModalBulkCopyAddressesRoutes.ExportAddressesModal
>) {
  const intl = useIntl();

  const { networkAccountsByDeriveType } = route.params;

  const handleExportAddresses = useCallback(() => {
    console.log('handleExportAddresses');
  }, []);
  const handleCopyAddresses = useCallback(() => {
    console.log('handleCopyAddresses');
  }, []);

  const renderAddresses = useCallback(() => {
    const data: {
      type: 'address' | 'title' | 'blankLine';
      address?: string;
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
          });
        });
        data.push({
          type: 'blankLine',
        });
      });
    }

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
          {data.map((item, index) => {
            return (
              <XStack key={index} alignItems="flex-start">
                <Stack width={32} justifyContent="flex-start">
                  <SizableText
                    size="$bodyLgMedium"
                    color="$textDisabled"
                    numberOfLines={1}
                    userSelect="none"
                  >
                    {index + 1}
                  </SizableText>
                </Stack>
                <Stack flex={1}>
                  {item.type === 'address' ? (
                    <SizableText
                      size="$bodyLg"
                      style={{
                        wordBreak: 'break-all',
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
  }, [intl, networkAccountsByDeriveType]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_export_addresses,
        })}
      />
      <Page.Body p="$5">{renderAddresses()}</Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirm={handleExportAddresses}
          onCancel={handleCopyAddresses}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_bulk_copy_addresses_export_csv,
          })}
          onCancelText={intl.formatMessage({
            id: ETranslations.global_copy,
          })}
          confirmButtonProps={{
            variant: 'primary',
          }}
          cancelButtonProps={{
            variant: 'secondary',
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default ExportAddresses;
