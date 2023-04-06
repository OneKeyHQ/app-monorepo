import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Modal,
  Progress,
  Text,
  VStack,
} from '@onekeyhq/components';
import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { CreateAccountModalRoutes } from '../../../routes/routesEnum';

import { formatDerivationLabel } from './helper';
import { useFetchSetRangeAddress } from './useFetchSetRangeAddress';
import { useFetchWalletAddress } from './useFetchWalletAddress';

import type { CreateAccountRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { INetworkDerivationItem } from './WalletAccounts';
import type { RouteProp } from '@react-navigation/native';

export type IExportAddressData = {
  data: {
    address: string;
    path: string;
    index: number;
  }[];
  template: string;
  name: string;
};

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.FetchAddressModal
>;

export type IWalletAccounts = INetworkDerivationItem & {
  accountData: (Account & {
    index: number;
    fullPath?: string;
    confirm?: boolean;
  })[];
};

const FetchAddressModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId, networkId, data, password } = route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const {
    progress: setRangeProgress,
    progressText: setRangeProgressText,
    previousAddress: setRangePreviousAddress,
    generatedAccounts,
    cancelFlagRef: setRangeCancelFlagRef,
  } = useFetchSetRangeAddress({
    data,
    walletId,
    networkId,
    password,
  });

  const {
    progress: walletAccountsProgress,
    progressText: walletAccountsProgressText,
    previousAddress: walletAccountsPreviousAddress,
    walletAccounts,
    cancelFlagRef: walletAccountsCancelFlagRef,
  } = useFetchWalletAddress({
    data,
    walletId,
    networkId,
    password,
  });

  const isHwWallet = walletId.startsWith('hw');
  const cancelFlagRef = useRef(false);
  const handleExportDataRef = useRef(false);

  const isSetRangeMode = data.type === 'setRange';

  const progress = useMemo(
    () => (isSetRangeMode ? setRangeProgress : walletAccountsProgress),
    [isSetRangeMode, setRangeProgress, walletAccountsProgress],
  );

  const progressText = useMemo(
    () => (isSetRangeMode ? setRangeProgressText : walletAccountsProgressText),
    [isSetRangeMode, setRangeProgressText, walletAccountsProgressText],
  );

  const previousAddress = useMemo(
    () =>
      isSetRangeMode ? setRangePreviousAddress : walletAccountsPreviousAddress,
    [isSetRangeMode, setRangePreviousAddress, walletAccountsPreviousAddress],
  );

  const setCancelFlag = useCallback(
    (flag: boolean) => {
      cancelFlagRef.current = flag;
      setRangeCancelFlagRef.current = flag;
      walletAccountsCancelFlagRef.current = flag;
    },
    [setRangeCancelFlagRef, walletAccountsCancelFlagRef],
  );

  useEffect(() => {
    if (handleExportDataRef.current) return;
    if (progress >= 1) {
      handleExportDataRef.current = true;
      let exportData: IExportAddressData[];
      if (isSetRangeMode) {
        exportData = [
          {
            template: data.derivationOption?.template ?? '',
            name:
              formatDerivationLabel(intl, data.derivationOption?.label) ?? '',
            data: generatedAccounts.map((account) => ({
              address: account.displayAddress,
              path: account.path,
              index: account.index,
            })),
          },
        ];
      } else {
        exportData = walletAccounts.map((networkDerivation) => ({
          template: networkDerivation.template,
          name: networkDerivation.name ?? '',
          data: networkDerivation.accountData.map((account) => ({
            index: account.index,
            address: account.address,
            path: account.path,
          })),
        }));
      }

      setTimeout(() => {
        if (cancelFlagRef.current) {
          return;
        }
        if (exportData.every((i) => !i.data.length)) {
          navigation.goBack();
          return;
        }
        navigation.replace(CreateAccountModalRoutes.ExportAddresses, {
          networkId,
          walletId,
          data: exportData,
        });
      }, 500);
    }
  }, [
    progress,
    isSetRangeMode,
    data,
    generatedAccounts,
    walletAccounts,
    intl,
    networkId,
    walletId,
    isHwWallet,
    navigation,
  ]);

  return (
    <Modal
      height={isHwWallet ? 'auto' : '375px'}
      header={undefined}
      closeable={false}
      closeOnOverlayClick={false}
      hideSecondaryAction
      hideBackButton
      headerShown={false}
      primaryActionTranslationId="action__cancel"
      primaryActionProps={{
        type: 'basic',
      }}
      onPrimaryActionPress={async () => {
        setCancelFlag(true);
        if (isHwWallet) {
          const device = await backgroundApiProxy.engine.getHWDeviceByWalletId(
            walletId,
          );
          if (device) {
            backgroundApiProxy.serviceHardware.cancel(device.mac);
          }
        }
        navigation.goBack();
      }}
    >
      <Center w="full" h="full">
        <Box mt={6}>
          <Progress.Circle
            progress={progress}
            text={
              <Center>
                <Text typography={{ sm: 'DisplayMedium', md: 'DisplayLarge' }}>
                  {progressText}
                </Text>
              </Center>
            }
          />
        </Box>
        <Text mt={6} typography={{ sm: 'Heading', md: 'Heading' }}>
          {intl.formatMessage({ id: 'title__fetching_addresses' })}
        </Text>
        {previousAddress && (
          <VStack mt={4} space={1}>
            <Text
              textAlign="center"
              typography={{ sm: 'Body2Strong', md: 'Body2Strong' }}
              color="text-subdued"
            >
              {intl.formatMessage({
                id: 'form__previous_confirmed',
              })}
            </Text>
            <Text
              typography={{ sm: 'Body2', md: 'Body2' }}
              wordBreak="break-all"
            >
              {previousAddress}
            </Text>
          </VStack>
        )}
      </Center>
    </Modal>
  );
};

export default FetchAddressModal;
