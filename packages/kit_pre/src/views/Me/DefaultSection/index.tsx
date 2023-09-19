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
import { HomeRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAddressBook } from '../../AddressBook/Listing';
import { EOnboardingRoutes } from '../../Onboarding/routes/enums';
import { MigrationEnable } from '../../Onboarding/screens/Migration/util';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.ScreenOnekeyLiteDetail
>;

export const DefaultSection = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const navigationRoot = useAppNavigation();
  const appNavigation = useAppNavigation();
  const { themeVariant } = useTheme();

  const { showAddressBookModal } = useAddressBook();
  return (
    <Box w="full" mb="6">
      <Box
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {MigrationEnable && (
          <>
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              py={4}
              px={{ base: 4, md: 6 }}
              onPress={() => {
                appNavigation.navigate(RootRoutes.Onboarding, {
                  screen: EOnboardingRoutes.Migration,
                  params: {},
                });
              }}
            >
              <Icon name="ArrowPathRoundedSquareOutline" />
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mx={3}
              >
                {intl.formatMessage({ id: 'title__migration' })}
              </Text>
              <Box>
                <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
              </Box>
            </Pressable>
            <Divider />
          </>
        )}

        {supportedNFC && (
          <>
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              py={4}
              px={{ base: 4, md: 6 }}
              onPress={() => {
                navigation.navigate(HomeRoutes.ScreenOnekeyLiteDetail);
              }}
            >
              <Icon name="OnekeyLiteOutline" />
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex="1"
                numberOfLines={1}
                mx={3}
              >
                {intl.formatMessage({
                  id: 'app__hardware_name_onekey_lite',
                })}
              </Text>
              <Box>
                <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
              </Box>
            </Pressable>
            <Divider />
          </>
        )}
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          onPress={() => {
            navigationRoot.navigate(RootRoutes.Onboarding, {
              screen: EOnboardingRoutes.KeyTag,
            });
          }}
        >
          <Icon name="KeytagOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__onekey_keytag',
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
            showAddressBookModal();
          }}
        >
          <Icon name="BookOpenOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex="1"
            numberOfLines={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'title__address_book',
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
