import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Button, Stack, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
import {
  getCexDepositWarningFacts,
  isCexDepositExplicitlyDisabled,
} from '@onekeyhq/shared/src/utils/cexDepositSupportUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAddressInteractionStatus } from '@onekeyhq/shared/types/address';

import { AddressBadge } from '../AddressBadge';

import {
  cexDepositWarningMessages,
  formatCexDepositWarningMessage,
} from './cexDepositWarningMessages';
import { useIsEnableTransferAllowList } from './hooks';

import type { IAddressQueryResult } from '.';

export function AddressInputWarnings({
  queryResult,
  networkId,
  tokenSymbol,
  networkName,
}: {
  queryResult: IAddressQueryResult;
  networkId: string;
  tokenSymbol?: string;
  networkName?: string;
}) {
  const intl = useIntl();
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const navigation = useAppNavigation();

  // Interaction badges use semantic types (success/warning/critical),
  // while label badges (OKX, CEX) use "default" or "info" type.
  const interactionBadges = useMemo(
    () =>
      (queryResult?.addressBadges ?? []).filter(
        (badge) => badge.type !== 'default' && badge.type !== 'info',
      ),
    [queryResult?.addressBadges],
  );

  const showAddToAddressBook = useMemo(() => {
    // Don't show if already in address book or wallet
    if (queryResult?.addressBookId || queryResult?.walletAccountId)
      return false;
    // Show for transferred addresses (add to address book guidance)
    if (
      queryResult?.addressInteractionStatus ===
      EAddressInteractionStatus.INTERACTED
    )
      return true;
    // Show for first-transfer addresses when allowlist is enabled
    // (user needs to add to address book to send)
    if (
      isEnableTransferAllowList &&
      queryResult?.addressInteractionStatus ===
        EAddressInteractionStatus.NOT_INTERACTED
    )
      return true;
    return false;
  }, [
    queryResult?.addressBookId,
    queryResult?.walletAccountId,
    queryResult?.addressInteractionStatus,
    isEnableTransferAllowList,
  ]);

  const onAddToAddressBook = useCallback(() => {
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.EditItemModal,
      params: {
        address: queryResult?.input ?? '',
        networkId,
        isAllowListed: isEnableTransferAllowList,
      },
    });
  }, [isEnableTransferAllowList, navigation, networkId, queryResult?.input]);

  const showCexDepositWarning =
    !networkUtils.isLightningNetworkByNetworkId(networkId) &&
    isCexDepositExplicitlyDisabled(queryResult.cexSupportedInfo?.depositEnable);
  const facts = getCexDepositWarningFacts({
    tokenSymbol,
    networkName,
    exchangeLabel: queryResult.cexSupportedInfo?.cexLabel,
    addressBadges: queryResult.addressBadges,
  });
  const values = {
    exchange: facts.exchangeName,
    token: facts.tokenSymbol,
    network: facts.networkName,
  };
  let title = facts.exchangeName
    ? cexDepositWarningMessages.inlineTitleWithoutAssetOrNetwork
    : cexDepositWarningMessages.inlineTitleWithoutDetails;
  if (facts.tokenSymbol && facts.networkName) {
    title = facts.exchangeName
      ? cexDepositWarningMessages.inlineTitle
      : cexDepositWarningMessages.inlineTitleWithoutExchange;
  }

  if (
    !showCexDepositWarning &&
    interactionBadges.length === 0 &&
    !showAddToAddressBook
  ) {
    return null;
  }

  return (
    <Stack pt="$1.5" gap="$2">
      {showCexDepositWarning ? (
        <Alert
          testID="address-input-cex-deposit-warning"
          type="warning"
          icon="ErrorOutline"
          title={formatCexDepositWarningMessage(intl, title, values)}
          description={formatCexDepositWarningMessage(
            intl,
            facts.exchangeName
              ? cexDepositWarningMessages.inlineDescription
              : cexDepositWarningMessages.inlineDescriptionWithoutExchange,
            values,
          )}
        />
      ) : null}
      {interactionBadges.length > 0 || showAddToAddressBook ? (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          {interactionBadges.map((badge) => (
            <AddressBadge
              key={badge.label}
              title={badge.label}
              badgeType={badge.type}
              content={badge.tip}
              icon={badge.icon}
            />
          ))}
          {showAddToAddressBook ? (
            <Button
              testID="address-input-add-to-address-book-btn"
              variant="tertiary"
              size="small"
              onPress={onAddToAddressBook}
            >
              {intl.formatMessage({
                id: ETranslations.add_to_address_book__action,
              })}
            </Button>
          ) : null}
        </XStack>
      ) : null}
    </Stack>
  );
}
