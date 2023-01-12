import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { ImageBackground, useWindowDimensions } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Icon,
  Pressable,
  Text,
  VStack,
} from '@onekeyhq/components';
import bg1 from '@onekeyhq/kit/assets/annual/banner.jpg';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector, useNavigation } from '../../../../hooks';
import { HomeRoutes } from '../../../../routes/types';

import type { HomeRoutesParams } from '../../../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.AnnualLoading
>;

export const AnnualEntry: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const { width } = useWindowDimensions();

  const annualReportEntryEnabled = useAppSelector(
    (s) => s.settings?.annualReportEntryEnabled ?? false,
  );

  const toAnnual = useCallback(() => {
    navigation.navigate(HomeRoutes.AnnualLoading);
  }, [navigation]);

  if (
    !annualReportEntryEnabled ||
    !(platformEnv.isNativeAndroid || platformEnv.isNativeIOSPhone)
  ) {
    return null;
  }

  return (
    <Center w="full" alignItems="center" my="8">
      <Box borderRadius="12px" overflow="hidden">
        <Pressable onPress={toAnnual}>
          <ImageBackground
            source={bg1}
            resizeMode="cover"
            style={{
              width: width - 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HStack
              alignItems="center"
              w="100%"
              justifyContent="space-between"
              p="4"
            >
              <VStack>
                <Text
                  fontWeight="700"
                  fontSize="20"
                  color="#E2E2E8"
                  numberOfLines={1}
                >
                  {intl.formatMessage({ id: 'title__my_on_chain_journey' })}
                </Text>
                <Text fontSize="14px" color="#E2E2E8" numberOfLines={2}>
                  {intl.formatMessage({
                    id: 'title__my_on_chain_journey_desc',
                  })}
                </Text>
              </VStack>
              <Icon size={23} name="ChevronRightMini" />
            </HStack>
          </ImageBackground>
        </Pressable>
      </Box>
    </Center>
  );
};
