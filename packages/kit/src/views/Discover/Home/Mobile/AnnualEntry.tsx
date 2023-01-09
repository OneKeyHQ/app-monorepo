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
import bg1 from '@onekeyhq/kit/assets/annual/1.png';

import { useNavigation } from '../../../../hooks';
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

  const toAnnual = useCallback(() => {
    navigation.navigate(HomeRoutes.AnnualLoading);
  }, [navigation]);

  return (
    <Center w="full" alignItems="center" my="8">
      <Box borderRadius="12px" overflow="hidden">
        <Pressable onPress={toAnnual}>
          <ImageBackground
            source={bg1}
            resizeMode="cover"
            style={{
              width: width - 32,
              height: 84,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HStack alignItems="center">
              <VStack>
                <Text fontWeight="700" fontSize="20" color="#E2E2E8">
                  {intl.formatMessage({ id: 'title__my_on_chain_journey' })}
                </Text>
                <Text fontSize="14px" color="#E2E2E8">
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
