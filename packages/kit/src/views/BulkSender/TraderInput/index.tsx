import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, HStack, Text } from '@onekeyhq/components';

import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { AddressBookRoutes } from '../../AddressBook/routes';
import { TraderEditor } from '../TraderEditor';
import { TraderUploader } from '../TraderUploader';
import { AmountTypeEnum, type TraderInputParams } from '../types';

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
  } = props;
  const intl = useIntl();
  const [showFileError, setShowFileError] = useState(false);
  const navigation = useNavigation();

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
          onAccountsSelected: (addresses) => {
            setIsUploadMode(false);
            if (isSingleMode) {
              setTraderFromOut([
                {
                  Address: addresses[0],
                },
              ]);
            } else {
              setTraderFromOut([
                ...trader,
                ...addresses.map((address) =>
                  amountType === AmountTypeEnum.Custom && withAmount
                    ? {
                        Address: address,
                        Amount: amount[0],
                      }
                    : {
                        Address: address,
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
    withAmount,
  ]);

  const handleSelectContactOnPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.PickAddressRoute,
        params: {
          networkId,
          onSelected: ({ address }) => {
            setIsUploadMode(false);
            if (isSingleMode) {
              setTraderFromOut([
                {
                  Address: address,
                },
              ]);
            } else {
              setTraderFromOut([
                ...trader,
                amountType === AmountTypeEnum.Custom && withAmount
                  ? {
                      Address: address,
                      Amount: amount[0],
                    }
                  : {
                      Address: address,
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
        <HStack>
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
            {intl.formatMessage({ id: 'title__contacts' })}
          </Button>
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
