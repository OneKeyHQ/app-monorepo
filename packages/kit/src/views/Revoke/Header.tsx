import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAsync } from 'react-async-hook';
import { useIntl } from 'react-intl';

import {
  HStack,
  Icon,
  IconButton,
  Input,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';

import showAboutOverlay from './Overlays/About';
import SvgRevoke from './Svg';
import { RevokeRoutes } from './types';

type Props = {
  onChange: (params: {
    loading: boolean;
    networkId?: string;
    address?: string;
  }) => void;
};

const RevokeHeader: FC<Props> = ({ onChange }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const [networkId, setNetworkId] = useState<string | undefined>();
  const [addressOrName, setAddressOrName] = useState<string | undefined>();
  const { accountAddress, networkId: activeNetworkId } =
    useActiveWalletAccount();
  const isVertical = useIsVerticalLayout();

  const { loading, result: address } = useAsync(async () => {
    const res = await backgroundApiProxy.serviceRevoke.getAddress(
      addressOrName ?? '',
      networkId,
    );
    return res;
  }, [addressOrName, networkId]);

  const { result: ens } = useAsync(async () => {
    if (!address) {
      return '';
    }
    return backgroundApiProxy.serviceRevoke.lookupEnsName(address);
  }, [address]);

  useEffect(() => {
    onChange({
      networkId,
      address,
      loading,
    });
  }, [address, networkId, onChange, loading]);

  useEffect(() => {
    if (activeNetworkId) {
      setNetworkId(activeNetworkId);
    }
  }, [activeNetworkId]);

  useEffect(() => {
    setAddressOrName(accountAddress);
    const onActiveAccountChange = () => {
      setAddressOrName(accountAddress);
    };
    appUIEventBus.on(AppUIEventBusNames.AccountChanged, onActiveAccountChange);
    return () => {
      appUIEventBus.off(
        AppUIEventBusNames.AccountChanged,
        onActiveAccountChange,
      );
    };
  }, [accountAddress]);

  const share = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Revoke,
      params: {
        screen: RevokeRoutes.ShareModal,
      },
    });
  }, [navigation]);

  return (
    <>
      <SvgRevoke />
      <HStack my="18px">
        <IconButton
          type="plain"
          name="InformationCircleMini"
          iconSize={16}
          onPress={showAboutOverlay}
        >
          <Typography.Button2>
            {intl.formatMessage({ id: 'title__about' })}
          </Typography.Button2>
        </IconButton>
        <IconButton
          type="plain"
          name="PaperAirplaneMini"
          iconSize={16}
          onPress={share}
        >
          <Typography.Button2>
            {intl.formatMessage({ id: 'title__share' })}
          </Typography.Button2>
        </IconButton>
      </HStack>
      <VStack w="full">
        <HStack flex="1" justifyContent="center">
          <Input
            flex="1"
            maxW="480px"
            value={ens || addressOrName || ''}
            minWidth={isVertical ? undefined : '480px'}
            onChangeText={setAddressOrName}
            textAlign="center"
            placeholder={intl.formatMessage({
              id: 'form__enter_address_ens_name',
            })}
          />
        </HStack>
        {accountAddress !== addressOrName && (
          <HStack alignItems="center" justifyContent="center" mt="14">
            <Icon name="InformationCircleMini" size={16} />
            <Typography.CaptionStrong ml="10px">
              {intl.formatMessage({
                id: 'content__connect_this_wallet_to_make_further_action',
              })}
            </Typography.CaptionStrong>
          </HStack>
        )}
      </VStack>
    </>
  );
};

export default RevokeHeader;
