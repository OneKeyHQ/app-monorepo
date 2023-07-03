/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Text,
  ToastManager,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';

import { useActiveWalletAccount } from '../../../../../../hooks/redux';
import useFormatDate from '../../../../../../hooks/useFormatDate';
import { DetailItem } from '../DetailItem';

function BTCAssetDetailContent({
  asset: outerAsset,

  isOwner,
}: {
  asset: NFTBTCAssetModel;
  network: Network;
  isOwner: boolean;
}) {
  const intl = useIntl();
  const { format } = useFormatDate();

  const { wallet } = useActiveWalletAccount();

  const [asset, updateAsset] = useState(outerAsset);
  const isDisabled = wallet?.type === WALLET_TYPE_WATCHING;

  const sendAction = () => {};

  return (
    <VStack space="24px" mb="50px">
      {asset?.inscription_number > 0 ? (
        <Text
          typography={{ sm: 'DisplayLarge', md: 'DisplayLarge' }}
          fontWeight="700"
        >
          {`Inscription  #${asset?.inscription_number}`}
        </Text>
      ) : null}

      {isOwner && (
        <HStack space="16px">
          <Button
            type="primary"
            isDisabled
            width="full"
            size="lg"
            leftIconName="ArrowUpMini"
            onPress={sendAction}
          >
            {intl.formatMessage({
              id: 'action__send',
            })}
          </Button>
          {/* More button in future */}
        </HStack>
      )}

      {/* Details */}
      <Box>
        <Typography.Heading mb="16px">
          {intl.formatMessage({ id: 'content__details' })}
        </Typography.Heading>
        <VStack space="16px">
          {!!asset.content_type && (
            <DetailItem
              title="ID"
              value={shortenAddress(asset.inscription_id, 6)}
              icon="Square2StackMini"
              onPress={() => {
                copyToClipboard(asset.inscription_id ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )}
          {!!asset.owner && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_owner' })}
              icon="Square2StackMini"
              value={shortenAddress(asset.owner, 6)}
              onPress={() => {
                copyToClipboard(asset.owner ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )}
          {!!asset.content_type && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_type' })}
              value={asset.content_type}
            />
          )}

          {!!asset.content_length && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_size' })}
              value={`${asset.content_length} bytes`}
            />
          )}

          {!!asset.output_value_sat && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_value' })}
              value={`${asset.output_value_sat} sats`}
            />
          )}
          {!!asset.timestamp && (
            <DetailItem
              title={intl.formatMessage({
                id: 'form__ordinal_inscription_date',
              })}
              value={format(
                new Date(Number(asset.timestamp) * 1000),
                'MMM d, yyyy, HH:mm',
              )}
            />
          )}
          {!!asset.location && (
            <DetailItem
              title={intl.formatMessage({
                id: 'form__ordinal_location',
              })}
              icon="ArrowTopRightOnSquareOutline"
              value={shortenAddress(asset.location, 6)}
            />
          )}
          {!!asset.genesis_transaction_hash && (
            <DetailItem
              title={intl.formatMessage({
                id: 'form__ordinal_genesis_tx',
              })}
              icon="ArrowTopRightOnSquareOutline"
              value={shortenAddress(asset.genesis_transaction_hash, 6)}
            />
          )}
        </VStack>
      </Box>
    </VStack>
  );
}

export { BTCAssetDetailContent };
