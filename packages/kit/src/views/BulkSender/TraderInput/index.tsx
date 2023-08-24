import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { WalletType } from '@onekeyhq/engine/src/types/wallet';

import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { AddressBookRoutes } from '../../AddressBook/routes';
import { TraderEditor } from '../TraderEditor';
import { TraderUploader } from '../TraderUploader';
import {
  AmountTypeEnum,
  type TraderInputParams,
  TraderTypeEnum,
} from '../types';

const SENDER_WALLETS_TO_HIDE = ['external', 'watching'] as WalletType[];

function TraderInput(props: TraderInputParams) {
  const {
    header,
    accountId,
    networkId,
    amount,
    amountType,
    token,
    trader,
    traderFromOut,
    setTraderFromOut,
    setTrader,
    traderErrors,
    isUploadMode,
    isSingleMode,
    setIsUploadMode,
    withAmount,
    traderType,
  } = props;
  const intl = useIntl();
  const [showFileError, setShowFileError] = useState(false);
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();

  const handleSelectAccountsOnPress = useCallback(() => {
    setIsUploadMode(false);
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageNetwork,
      params: {
        screen: ManageNetworkModalRoutes.NetworkAccountSelector,
        params: {
          hideAllNetworks: true,
          hideSideChain: true,
          hideSearchBar: true,
          hideCreateAccount: true,
          hideAccountActions: true,
          tokenShowBalance: token,
          multiSelect: !isSingleMode,
          singleSelect: isSingleMode,
          walletsToHide:
            traderType === TraderTypeEnum.Sender ? SENDER_WALLETS_TO_HIDE : [],
          onAccountsSelected: (addresses) => {
            setIsUploadMode(false);
            if (isSingleMode) {
              setTraderFromOut([
                {
                  address: addresses[0],
                },
              ]);
            } else {
              setTraderFromOut([
                ...trader,
                ...addresses.map((address) =>
                  amountType === AmountTypeEnum.Custom && withAmount
                    ? {
                        address,
                        amount: amount[0],
                      }
                    : {
                        address,
                      },
                ),
              ]);
            }
          },
        },
      },
    });
  }, [
    amount,
    amountType,
    isSingleMode,
    navigation,
    setIsUploadMode,
    setTraderFromOut,
    token,
    trader,
    traderType,
    withAmount,
  ]);

  const handleSelectContactOnPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.PickAddressRoute,
        params: {
          networkId,
          walletsToHide:
            traderType === TraderTypeEnum.Sender ? SENDER_WALLETS_TO_HIDE : [],
          onSelected: ({ address }) => {
            setIsUploadMode(false);
            if (isSingleMode) {
              setTraderFromOut([
                {
                  address,
                },
              ]);
            } else {
              setTraderFromOut([
                ...trader,
                amountType === AmountTypeEnum.Custom && withAmount
                  ? {
                      address,
                      amount: amount[0],
                    }
                  : {
                      address,
                    },
              ]);
            }
          },
        },
      },
    });
  }, [
    amount,
    amountType,
    isSingleMode,
    navigation,
    networkId,
    setIsUploadMode,
    setTraderFromOut,
    trader,
    traderType,
    withAmount,
  ]);

  useEffect(() => {
    setShowFileError(false);
  }, [isUploadMode]);

  return (
    <>
      <HStack justifyContent="space-between" alignItems="center" mb="10px">
        <Text fontSize={18} typography="Heading">
          {header}
        </Text>
        <HStack space={isVertical ? 1 : 0}>
          {isVertical ? (
            <>
              <IconButton
                name="ArrowUpTrayMini"
                bgColor="surface-default"
                shadow="none"
                borderWidth={0}
                circle
                onPress={() => setIsUploadMode(!isUploadMode)}
              />
              <IconButton
                name="UserCircleOutline"
                bgColor="surface-default"
                shadow="none"
                borderWidth={0}
                circle
                onPress={handleSelectAccountsOnPress}
              />
              <IconButton
                name="BookOpenOutline"
                bgColor="surface-default"
                shadow="none"
                borderWidth={0}
                circle
                onPress={handleSelectContactOnPress}
              />
            </>
          ) : (
            <>
              <Button
                type="plain"
                leftIconName="ArrowUpTrayMini"
                onPress={() => setIsUploadMode(!isUploadMode)}
              >
                {intl.formatMessage({
                  id: isUploadMode ? 'action__edit' : 'action__upload',
                })}
              </Button>
              <Button
                type="plain"
                leftIconName="UserCircleOutline"
                onPress={handleSelectAccountsOnPress}
              >
                {intl.formatMessage({ id: 'form__account' })}
              </Button>
              <Button
                type="plain"
                leftIconName="BookOpenOutline"
                onPress={handleSelectContactOnPress}
              >
                {intl.formatMessage({ id: 'title__address_book' })}
              </Button>
            </>
          )}
        </HStack>
      </HStack>
      <Box display={isUploadMode ? 'flex' : 'none'}>
        <TraderUploader
          showFileError={showFileError}
          setShowFileError={setShowFileError}
          setTraderFromOut={setTraderFromOut}
          setIsUploadMode={setIsUploadMode}
        />
      </Box>
      <Box display={isUploadMode ? 'none' : 'flex'}>
        <TraderEditor
          amount={amount}
          traderType={traderType}
          amountType={amountType}
          accountId={accountId}
          networkId={networkId}
          setTrader={setTrader}
          trader={trader}
          traderFromOut={traderFromOut}
          setTraderFromOut={setTraderFromOut}
          traderErrors={traderErrors}
          showFileError={showFileError}
          setShowFileError={setShowFileError}
          isSingleMode={isSingleMode}
          withAmount={withAmount}
        />
      </Box>
    </>
  );
}

export { TraderInput };
