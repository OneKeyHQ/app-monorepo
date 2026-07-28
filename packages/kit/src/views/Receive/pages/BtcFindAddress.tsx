import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Divider,
  Input,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { BTC_FIND_ADDRESS_MAX_INDEX } from '@onekeyhq/shared/src/consts/chainConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ReceiveTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';

function parseIndexText(indexText: string): number | undefined {
  if (!/^\d+$/.test(indexText)) {
    return undefined;
  }
  const index = Number(indexText);
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index > BTC_FIND_ADDRESS_MAX_INDEX
  ) {
    return undefined;
  }
  return index;
}

function renderReadonlyRow(label: string, value: string) {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      gap="$3"
      minHeight={38}
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size="$bodyMd"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function BtcFindAddress() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.BtcFindAddress>
    >();
  const {
    accountId,
    networkId,
    accountName,
    accountPath,
    addressTypeLabel,
    deriveType,
  } = route.params;

  const [indexText, setIndexText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Indexes at or below this are auto-tracked by the gap scan and must not
  // be claimed manually; the input rejects them up front.
  const { result: maxScannedIndexResult } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceFreshAddress.getBtcFindAddressMaxScannedIndex({
        accountId,
        networkId,
      }),
    [accountId, networkId],
  );
  const maxScannedIndex = maxScannedIndexResult?.maxScannedIndex;

  const parsedIndex = useMemo(() => parseIndexText(indexText), [indexText]);
  const showInvalidHint = indexText.length > 0 && parsedIndex === undefined;
  const isBelowMinIndex =
    parsedIndex !== undefined &&
    maxScannedIndex !== undefined &&
    parsedIndex <= maxScannedIndex;
  const pathPreview = `${accountPath}/0/${
    parsedIndex === undefined ? 'N' : parsedIndex
  }`;

  const minIndexHint =
    maxScannedIndex === undefined
      ? ''
      : intl.formatMessage(
          { id: ETranslations.index_must_be_greater_then },
          { variant: maxScannedIndex },
        );

  const hasIndexError = showInvalidHint || isBelowMinIndex;

  const invalidIndexText = intl.formatMessage(
    { id: ETranslations.find_address_invalid_index__msg },
    { max: BTC_FIND_ADDRESS_MAX_INDEX },
  );

  const onConfirm = useCallback(async () => {
    if (submitting) {
      return;
    }
    if (parsedIndex === undefined) {
      Toast.error({
        title:
          indexText.trim().length === 0
            ? intl.formatMessage({
                id: ETranslations.find_address_empty_index__msg,
              })
            : invalidIndexText,
      });
      return;
    }
    setSubmitting(true);
    try {
      const { alreadyDiscovered } =
        await backgroundApiProxy.serviceFreshAddress.claimBtcFindAddress({
          accountId,
          networkId,
          index: parsedIndex,
        });
      if (alreadyDiscovered) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.find_address_already_exists__msg,
          }),
        });
      } else {
        defaultLogger.transaction.findAddress.findAddressClaimed({
          networkId,
          deriveType,
        });
      }
      navigation.pop();
    } catch (error) {
      // claimBtcFindAddress surfaces its own error toast; keep the user on the
      // page (input intact) to retry instead of re-throwing into an unhandled
      // rejection — Page.FooterActions does not await onConfirm.
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    parsedIndex,
    indexText,
    invalidIndexText,
    intl,
    accountId,
    networkId,
    deriveType,
    navigation,
  ]);

  return (
    <Page
      scrollEnabled
      scrollProps={{
        keyboardDismissMode: 'on-drag',
        keyboardShouldPersistTaps: 'handled',
      }}
    >
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.find_address__action })}
      />
      <Page.Body>
        <YStack gap="$4" px="$5" pt="$2">
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.find_address_warning__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.find_address_warning__desc,
            })}
            mb="$5"
          />
          <YStack>
            {renderReadonlyRow(
              intl.formatMessage({ id: ETranslations.global_account }),
              `${accountName} (${accountPath})`,
            )}
            <Divider my="$2" borderColor="$neutral3" />
            {renderReadonlyRow(
              intl.formatMessage({ id: ETranslations.address_type }),
              addressTypeLabel,
            )}
            <Divider my="$2" borderColor="$neutral3" />
            <YStack gap="$1.5">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.find_address_index__title,
                })}
              </SizableText>
              <Input
                testID={ReceiveTestIDs.BtcFindAddressIndexInput}
                size="large"
                $gtMd={{ size: 'medium' }}
                keyboardType="number-pad"
                inputMode="numeric"
                value={indexText}
                placeholder="0"
                onChangeText={(text) => setIndexText(text.trim())}
                error={hasIndexError}
              />
              {minIndexHint ? (
                <SizableText
                  size="$bodySm"
                  color={isBelowMinIndex ? '$textCritical' : '$textSubdued'}
                >
                  {minIndexHint}
                </SizableText>
              ) : null}
              {showInvalidHint ? (
                <SizableText size="$bodySm" color="$textCritical">
                  {invalidIndexText}
                </SizableText>
              ) : null}
            </YStack>
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.find_address_confirm__action,
          })}
          onConfirm={onConfirm}
          confirmButtonProps={{
            loading: submitting,
            disabled: hasIndexError,
          }}
        >
          <XStack
            alignItems="center"
            gap="$2"
            flexShrink={1}
            minWidth={0}
            $md={{ justifyContent: 'space-between', pb: '$5' }}
          >
            <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
              {intl.formatMessage({
                id: ETranslations.find_address_full_path__title,
              })}
            </SizableText>
            <SizableText
              size="$headingSm"
              color="$text"
              numberOfLines={1}
              flexShrink={1}
            >
              {pathPreview}
            </SizableText>
          </XStack>
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

export default BtcFindAddress;
