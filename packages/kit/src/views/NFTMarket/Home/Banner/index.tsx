import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  HStack,
  Hidden,
  Icon,
  Image,
  Pressable,
  Text,
} from '@onekeyhq/components';
import BannerPnl from '@onekeyhq/kit/assets/nft_banner_pnl.png';

const Banner = () => {
  const intl = useIntl();

  return (
    <Box
      flexDirection={{ md: 'row' }}
      mx={{ base: -4, md: 0 }}
      mt={{ base: -4, md: 0 }}
      pb={{ base: 4, md: 0 }}
      borderBottomWidth={{ base: StyleSheet.hairlineWidth, md: 0 }}
      borderBottomColor="divider"
    >
      <Pressable borderRadius={{ base: 0, md: '12px' }} overflow="hidden">
        <Image source={BannerPnl} w={456} h={280} />
      </Pressable>
      <Box mt={{ base: 3, md: 0 }} ml={{ md: 12 }} px={{ base: 4, md: 0 }}>
        <HStack>
          <Text
            typography={{ sm: 'DisplayMedium', md: 'Display2XLarge' }}
            flex={1}
          >
            NFT PnL
          </Text>
          <Hidden from="md">
            <Icon name="ArrowRightOutline" />
          </Hidden>
        </HStack>
        <Text
          typography={{ sm: 'Body2', md: 'Body1' }}
          mt={2}
          color="text-subdued"
        >
          {intl.formatMessage({ id: 'empty__pnl' })}
        </Text>
        <Hidden till="md">
          <Button
            type="primary"
            alignSelf="flex-start"
            mt={8}
            rightIconName="ArrowRightMini"
          >
            Get Started
          </Button>
        </Hidden>
      </Box>
    </Box>
  );
};

export default Banner;
