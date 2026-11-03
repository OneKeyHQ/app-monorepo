import type { ReactNode } from 'react';
import { useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Button,
  Empty,
  Page,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ClipboardPlugin } from '@onekeyhq/kit/src/components/AddressInput/plugins/clipboard';
import { BaseInput } from '@onekeyhq/kit/src/components/BaseInput';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { SendAutoSizeAmountInput } from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import { QuickSelectListItemFrame } from '@onekeyhq/kit/src/views/Send/pages/SendDataInput/QuickSelectListShared';
import { AccountRecipients } from '@onekeyhq/kit/src/views/Send/pages/SendDataInput/RecipientQuickSelect';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { getInternalTransferAddressError } from '@onekeyhq/shared/src/utils/perpsInternalTransferUtils';
import { getSpotTokenDisplayName } from '@onekeyhq/shared/src/utils/perpsUtils';

export function InternalTransferRecipientStep({
  sender,
  search,
  onChangeSearch,
  recentRecipients,
  disabled,
  onSelect,
}: {
  sender: string;
  search: string;
  onChangeSearch: (value: string) => void;
  recentRecipients: { address: string; amount: string; token: string }[];
  disabled: boolean;
  onSelect: (recipient: { address: string; name?: string }) => void;
}) {
  const [accountsSelected, setAccountsSelected] = useState(false);
  const showAccounts = accountsSelected || !recentRecipients.length;
  const [selectionError, setSelectionError] = useState<{
    search: string;
    message: string;
  }>();
  const debouncedSearch = useDebounce(search.trim(), 200);
  const addressError = getInternalTransferAddressError(search.trim(), sender);
  const select = (recipient: { address: string; name?: string }) => {
    if (disabled) return;
    const error = getInternalTransferAddressError(recipient.address, sender);
    setSelectionError(error ? { search, message: error } : undefined);
    if (!error) onSelect(recipient);
  };
  const visibleSelectionError =
    selectionError?.search === search ? selectionError.message : undefined;
  const recipients = recentRecipients.filter(({ address }) =>
    address.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <YStack gap="$4" pt="$3">
      <BaseInput
        testID="perps-internal-transfer-recipient"
        value={search}
        onChangeText={onChangeSearch}
        placeholder="Address or account name"
        numberOfLines={2}
        autoCapitalize="none"
        autoCorrect={false}
        disabled={disabled}
        extension={
          <XStack justifyContent="flex-end">
            {search ? (
              <Button
                size="small"
                variant="secondary"
                icon="BroomOutline"
                disabled={disabled}
                onPress={() => onChangeSearch('')}
                testID="perps-internal-transfer-recipient-clear"
              >
                Clear
              </Button>
            ) : (
              <ClipboardPlugin
                display="button"
                disabled={disabled}
                onChange={({ text }) => onChangeSearch(text)}
                testID="perps-internal-transfer-recipient-paste"
              />
            )}
          </XStack>
        }
      />
      {visibleSelectionError ||
      (search.trim().startsWith('0x') && addressError) ? (
        <SizableText color="$textCritical">
          {visibleSelectionError || addressError}
        </SizableText>
      ) : null}
      {addressError ? (
        <YStack gap="$3">
          {recentRecipients.length ? (
            <SegmentControl
              fullWidth
              value={showAccounts ? 'accounts' : 'recent'}
              options={[
                { label: 'Recent recipients', value: 'recent' },
                { label: 'My accounts', value: 'accounts' },
              ]}
              onChange={(value) => setAccountsSelected(value === 'accounts')}
            />
          ) : (
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              My accounts
            </SizableText>
          )}
          <YStack mx="$-5" pointerEvents={disabled ? 'none' : 'auto'}>
            {showAccounts ? (
              <AccountRecipients
                networkId={PERPS_NETWORK_ID}
                excludedAddress={sender}
                keylessWalletsOnly={platformEnv.isWebDappMode}
                searchKey={search.trim()}
                debouncedSearchKey={debouncedSearch}
                isSearchMode={Boolean(search.trim())}
                onSelect={select}
              />
            ) : (
              recipients.map((recipient) => (
                <QuickSelectListItemFrame
                  key={recipient.address}
                  address={recipient.address}
                  testID={`perps-internal-transfer-recent-${recipient.address}`}
                  onPress={() => select(recipient)}
                  primary={
                    <SizableText size="$bodyLgMedium" numberOfLines={1}>
                      {accountUtils.shortenAddress({
                        address: recipient.address,
                        leadingLength: 8,
                        trailingLength: 6,
                      })}
                    </SizableText>
                  }
                  secondary={
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {numberFormat(recipient.amount, { formatter: 'balance' })}{' '}
                      {getSpotTokenDisplayName(recipient.token)}
                    </SizableText>
                  }
                />
              ))
            )}
          </YStack>
          {!showAccounts && !recipients.length ? (
            <Empty
              icon="SearchOutline"
              title="No matching recipients"
              description="Try another address or search My accounts."
            />
          ) : null}
        </YStack>
      ) : null}
      {search.trim() ? (
        <Page.Footer>
          <YStack p="$5">
            <Button
              testID="perps-internal-transfer-continue"
              size="large"
              variant="primary"
              disabled={disabled || Boolean(addressError)}
              onPress={() => select({ address: search.trim() })}
            >
              Continue
            </Button>
          </YStack>
        </Page.Footer>
      ) : null}
    </YStack>
  );
}

export function InternalTransferAmountStep({
  amount,
  onChangeAmount,
  symbol,
  sourceSelector,
  tokenSelector,
  maxAmount,
  onMax,
  maxDisabled,
  disabled,
  fee,
  amountError,
}: {
  amount: string;
  onChangeAmount: (value: string) => void;
  symbol?: string;
  sourceSelector: ReactNode;
  tokenSelector: ReactNode;
  maxAmount?: string;
  onMax: () => void;
  maxDisabled: boolean;
  disabled: boolean;
  fee?: string;
  amountError?: string;
}) {
  return (
    <YStack flex={1} gap="$4">
      <YStack
        flex={1}
        minHeight={platformEnv.isNative ? 176 : 200}
        alignItems="center"
        justifyContent="center"
        gap="$2"
        py={platformEnv.isNative ? '$2' : '$6'}
      >
        <SendAutoSizeAmountInput
          value={amount}
          onChange={onChangeAmount}
          reversible={false}
          inlineTextAlignMode="center"
          inputProps={{
            placeholder: '0',
            editable: !platformEnv.isNative && !disabled,
            keyboardType: 'decimal-pad',
          }}
          extraContent={
            <YStack minHeight="$16" alignItems="center" gap="$1" pt="$2">
              {tokenSelector}
              {amountError ? (
                <SizableText
                  size="$bodySm"
                  color="$textCritical"
                  textAlign="center"
                >
                  {amountError}
                </SizableText>
              ) : null}
            </YStack>
          }
        />
      </YStack>
      <YStack
        bg="$bgSubdued"
        borderRadius="$3"
        px="$3.5"
        py="$2"
        width="100%"
        gap="$0.5"
        flexShrink={0}
      >
        <XStack
          minHeight={44}
          alignItems="center"
          justifyContent="space-between"
          gap="$2.5"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            From
          </SizableText>
          <YStack flexShrink={1} minWidth={0}>
            {sourceSelector}
          </YStack>
        </XStack>
        <Stack h="$px" bg="$borderSubdued" my="$1.5" />
        <XStack
          minHeight={44}
          alignItems="center"
          justifyContent="space-between"
          gap="$2.5"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            Available
          </SizableText>
          <XStack alignItems="center" gap="$2" flexShrink={1}>
            <SizableText size="$bodyLgMedium" color="$text" flexShrink={1}>
              {maxAmount !== undefined
                ? `${numberFormat(maxAmount, { formatter: 'balance' })} ${symbol ?? ''}`
                : '—'}
            </SizableText>
            <Button
              testID="perps-internal-transfer-max"
              size="small"
              px="$2.5"
              h="$8"
              minWidth={56}
              variant="secondary"
              disabled={maxDisabled}
              onPress={onMax}
            >
              Max
            </Button>
          </XStack>
        </XStack>
        {fee !== undefined && new BigNumber(fee).gt(0) ? (
          <>
            <Stack h="$px" bg="$borderSubdued" my="$1.5" />
            <XStack
              minHeight={44}
              alignItems="center"
              justifyContent="space-between"
              gap="$2.5"
            >
              <SizableText size="$bodySm" color="$textSubdued" flexShrink={1}>
                Activation fee
              </SizableText>
              <SizableText
                size="$bodyLgMedium"
                color="$text"
                textAlign="right"
                flexShrink={1}
              >
                {new BigNumber(fee).toFixed()} USD stablecoin
              </SizableText>
            </XStack>
          </>
        ) : null}
      </YStack>
    </YStack>
  );
}
