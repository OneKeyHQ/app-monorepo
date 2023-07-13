/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
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
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { TaprootAddressError } from '@onekeyhq/engine/src/errors';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../../../../hooks';
import { useActiveWalletAccount } from '../../../../../../hooks/redux';
import useFormatDate from '../../../../../../hooks/useFormatDate';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../../../../routes/routesEnum';
import { openUrl } from '../../../../../../utils/openUrl';
import { DetailItem } from '../DetailItem';

import type { CollectiblesRoutesParams } from '../../../../../../routes/Root/Modal/Collectibles';
import type { ModalScreenProps } from '../../../../../../routes/types';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

function BTCAssetDetailContent({
  asset: outerAsset,
  isOwner,
}: {
  asset: NFTBTCAssetModel;
  isOwner: boolean;
}) {
  const intl = useIntl();
  const { format } = useFormatDate();
  const { serviceNFT, serviceInscribe } = backgroundApiProxy;

  const { network } = useNetwork({
    networkId: outerAsset?.networkId ?? '',
  });

  const { wallet } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const modalClose = useModalClose();

  const [asset, updateAsset] = useState(outerAsset);
  const isDisabled =
    wallet?.type === WALLET_TYPE_WATCHING &&
    asset.owner !== outerAsset.accountAddress;

  const sendAction = useCallback(async () => {
    const { accountAddress, networkId } = outerAsset ?? {};
    if (!networkId || !accountAddress) {
      return;
    }
    const account = await backgroundApiProxy.serviceAccount.getAccountByAddress(
      {
        networkId,
        address: accountAddress ?? '',
      },
    );
    if (!account) {
      return;
    }
    const validateAddress = async (address: string) => {
      try {
        await serviceInscribe.checkValidTaprootAddress({
          address,
          networkId,
          accountId: account.id,
        });
      } catch (error) {
        throw new TaprootAddressError();
      }
    };
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.PreSendAddress,
        params: {
          accountId: account?.id,
          networkId,
          isNFT: true,
          from: '',
          to: '',
          amount: '0',
          nftTokenId: asset.inscription_id,
          validateAddress: async (_, address) => {
            await validateAddress(address);
          },
          nftInscription: {
            address: asset.owner,
            inscriptionId: asset.inscription_id,
            output: asset.output,
            location: asset.location,
          },
          closeModal: modalClose,
        },
      },
    });
  }, [
    asset.inscription_id,
    asset.location,
    asset.output,
    asset.owner,
    modalClose,
    navigation,
    outerAsset,
    serviceInscribe,
  ]);

  useEffect(() => {
    (async () => {
      if (network?.id) {
        const data = (await serviceNFT.fetchAsset({
          chain: network.id,
          tokenId: outerAsset.inscription_id,
        })) as NFTBTCAssetModel;
        if (data) {
          updateAsset(data);
        }
      }
    })();
  }, [network?.id, outerAsset.inscription_id, serviceNFT]);

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
            isDisabled={isDisabled}
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
          {!!asset.output_value_sat && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_value' })}
              value={`${asset.output_value_sat} sats`}
            />
          )}
          {!!asset.content_length && (
            <DetailItem
              title={intl.formatMessage({ id: 'form__ordinal_size' })}
              value={`${asset.content_length} bytes`}
            />
          )}
          {!!asset.timestamp && (
            <DetailItem
              onPress={() => {
                const isMainNet = network?.id === OnekeyNetwork.btc;
                const host = isMainNet
                  ? 'https://ordinals.com'
                  : 'http://ordinals-testnet.onekeytest.com';
                openUrl(`${host}/inscription/${asset.inscription_id}`);
              }}
              title={intl.formatMessage({
                id: 'form__ordinal_inscription_date',
              })}
              icon="ArrowTopRightOnSquareOutline"
              value={format(
                new Date(Number(asset.timestamp) * 1000),
                'MMM d, yyyy, HH:mm',
              )}
            />
          )}
          {/* {!!asset.location && (
            <DetailItem
              title={intl.formatMessage({
                id: 'form__ordinal_location',
              })}
              icon="Square2StackMini"
              value={shortenAddress(asset.location, 6)}
              onPress={() => {
                copyToClipboard(asset.location ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )} */}
          {/* {!!asset.genesis_transaction_hash && (
            <DetailItem
              onPress={() => {
                openUrl(
                  `https://ordinals.com/tx/${asset.genesis_transaction_hash}`,
                );
              }}
              title={intl.formatMessage({
                id: 'form__ordinal_genesis_tx',
              })}
              icon="ArrowTopRightOnSquareOutline"
              value={shortenAddress(asset.genesis_transaction_hash, 6)}
            />
          )} */}
        </VStack>
      </Box>
    </VStack>
  );
}

export { BTCAssetDetailContent };
