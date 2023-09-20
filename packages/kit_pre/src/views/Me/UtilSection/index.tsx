import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  Pressable,
  Text,
  useTheme,
} from '@onekeyhq/components';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  ModalScreenProps,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { gotoScanQrcode } from '../../../utils/gotoScanQrcode';
import { ManageConnectedSitesRoutes } from '../../ManageConnectedSites/types';

import type { ManageConnectedSitesRoutesParams } from '../../ManageConnectedSites/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = ModalScreenProps<ManageConnectedSitesRoutesParams>;
type NavigationStackProps = NativeStackNavigationProp<HomeRoutesParams>;
export const UtilSection = () => {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const stackNavigation = useNavigation<NavigationStackProps>();
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const onLock = useCallback(() => {
    backgroundApiProxy.serviceApp.lock(true);
  }, []);
  return (
    <Box w="full" mb="6">
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {platformEnv.isExtension ? (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            borderBottomWidth="1"
            borderBottomColor="divider"
            onPress={() => {
              stackNavigation.navigate(HomeRoutes.WalletSwitch);
            }}
          >
            <Icon name="OnekeyLogoOutline" />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {intl.formatMessage({ id: 'form__wallet_switch' })}
            </Text>
            <Box>
              <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
            </Box>
          </Pressable>
        ) : null}
        {isPasswordSet ? (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py={4}
            px={{ base: 4, md: 6 }}
            onPress={onLock}
          >
            <Icon name="LockClosedOutline" />
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex="1"
              numberOfLines={1}
              mx={3}
            >
              {intl.formatMessage({
                id: 'action__lock_now',
              })}
            </Text>
            <Box>
              <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
            </Box>
          </Pressable>
        ) : null}
        {platformEnv.isExtensionUiPopup ? (
          <>
            <Divider />
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              py={4}
              px={{ base: 4, md: 6 }}
              onPress={() => {
                backgroundApiProxy.serviceApp.openExtensionExpandTab({
                  routes: '',
                });
              }}
            >
              <Icon name="ArrowsPointingOutOutline" />
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mx={3}
              >
                {intl.formatMessage({
                  id: 'form__expand_view',
                })}
              </Text>
              <Box>
                <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
              </Box>
            </Pressable>
          </>
        ) : null}
        <Divider />
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            gotoScanQrcode();
          }}
        >
          <Icon name="ViewfinderCircleOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'title__scan_qr_code',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
        <Divider />
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManageConnectedSites,
              params: {
                screen: ManageConnectedSitesRoutes.ManageConnectedSitesModel,
              },
            });
          }}
        >
          <Icon name="LinkOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'action__connected_sites',
              defaultMessage: 'Connected Sites',
            })}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
};
