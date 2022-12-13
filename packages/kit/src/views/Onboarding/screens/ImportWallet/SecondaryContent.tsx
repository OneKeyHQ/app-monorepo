import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Hidden,
  Icon,
  Image,
  Pressable,
  Text,
} from '@onekeyhq/components';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';

type SecondaryContentProps = {
  onPressDrawerTrigger?: () => void;
};

const defaultProps = {} as const;

const SecondaryContent: FC<SecondaryContentProps> = ({
  onPressDrawerTrigger,
}) => {
  const intl = useIntl();

  return (
    <>
      <Hidden from="base" till="sm">
        <Box
          p={3}
          rounded="full"
          bgColor="decorative-surface-one"
          alignSelf="flex-start"
        >
          <Icon
            name="DotsCircleHorizontalOutline"
            color="decorative-icon-one"
          />
        </Box>
      </Hidden>
      <Text typography="Body2Strong" mt={{ base: 16, sm: 8 }}>
        {intl.formatMessage({ id: 'content__what_is_recovery_phrase' })}
      </Text>
      <Text typography="Body2" color="text-subdued" mt={2} mb={6}>
        {intl.formatMessage({
          id: 'content__what_is_recovery_phrase_desc',
        })}
      </Text>
      <Text typography="Body2Strong">
        {intl.formatMessage({
          id: 'content__safe_to_enter_into_onekey',
        })}
      </Text>
      <Text typography="Body2" color="text-subdued" mt={2} mb={6}>
        {intl.formatMessage({
          id: 'content__safe_to_enter_into_onekey_desc',
        })}
      </Text>
      <Text typography="Body2Strong">
        {intl.formatMessage({
          id: 'content__where_find_phrase',
        })}
      </Text>
      <Pressable mx={-2} mt={2} onPress={onPressDrawerTrigger}>
        {({ isHovered, isPressed }) => (
          <Box
            flexDir="row"
            py={{ base: 3, sm: 2 }}
            px={2}
            bgColor={
              // eslint-disable-next-line no-nested-ternary
              isPressed
                ? 'surface-pressed'
                : isHovered
                ? 'surface-hovered'
                : undefined
            }
            rounded="xl"
          >
            <Image
              source={LogoMetaMask}
              size={5}
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="border-subdued"
              rounded="lg"
            />
            <Text flex={1} typography="Body2Strong" ml={3}>
              MetaMask
            </Text>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        )}
      </Pressable>
    </>
  );
};

SecondaryContent.defaultProps = defaultProps;

export default SecondaryContent;
