import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

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
    traderFromOut,
    setTraderFromOut,
    setTrader,
    traderErrors,
    isUploadMode,
    setIsUploadMode,
  } = props;
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
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
          multiSelect: true,
          tokenShowBalance: token,
          onAccountsSelected: (addresses) => {
            setIsUploadMode(false);
            setTraderFromOut((prev) => [
              ...prev,
              ...addresses.map((address) =>
                amountType === AmountTypeEnum.Custom
                  ? {
                      Address: address,
                      Amount: amount[0],
                    }
                  : {
                      Address: address,
                    },
              ),
            ]);
          },
        },
      },
    });
  }, [
    amount,
    amountType,
    navigation,
    setIsUploadMode,
    setTraderFromOut,
    token,
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
            setTraderFromOut((prev) => [
              ...prev,
              amountType === AmountTypeEnum.Custom
                ? {
                    Address: address,
                    Amount: amount[0],
                  }
                : {
                    Address: address,
                  },
            ]);
          },
        },
      },
    });
  }, [
    amount,
    amountType,
    navigation,
    networkId,
    setIsUploadMode,
    setTraderFromOut,
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
          traderFromOut={traderFromOut}
          setTraderFromOut={setTraderFromOut}
          traderErrors={traderErrors}
          showFileError={showFileError}
          setShowFileError={setShowFileError}
        />
      </Box>
    </>
  );
}

export { TraderInput };
