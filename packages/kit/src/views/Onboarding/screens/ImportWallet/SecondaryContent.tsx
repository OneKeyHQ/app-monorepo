import type { FC } from 'react';
import { useMemo } from 'react';

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

import type { IAddExistingWalletMode } from '../../../../routes';
import type { MessageDescriptor } from 'react-intl';

type SecondaryContentProps = {
  mode: IAddExistingWalletMode;
  onPressDrawerTrigger?: () => void;
};

const defaultProps = {} as const;

const SecondaryContent: FC<SecondaryContentProps> = ({
  onPressDrawerTrigger,
  mode,
}) => {
  const intl = useIntl();

  const getContents = useMemo((): {
    title?: MessageDescriptor['id'] | undefined;
    description?: MessageDescriptor['id'] | undefined;
  }[] => {
    if (mode === 'mnemonic') {
      return [
        {
          title: 'content__what_is_recovery_phrase',
          description: 'content__what_is_recovery_phrase_desc',
        },
        {
          title: 'content__safe_to_enter_into_onekey',
          description: 'content__safe_to_enter_into_onekey_desc',
        },
        {
          title: 'content__where_find_phrase',
        },
      ];
    }
    if (mode === 'imported')
      return [
        {
          title: 'content__what_is_private_key',
          description: 'content__what_is_private_key_desc',
        },
        {
          title: 'content__safe_to_enter_into_onekey',
          description: 'content__safe_to_enter_into_onekey_desc',
        },
        {
          title: 'content__where_find_private_key',
        },
      ];
    return [
      {
        title: 'content__what_is_watch_only_account',
        description: 'content__what_is_watch_only_account_desc',
      },
    ];
  }, [mode]);

  // todo 根据mode 判断 词条选择
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
      <Box mt={{ base: 16, sm: 8 }}>
        {getContents.map((item, index) => (
          <Box key={index} mb={index === getContents.length - 1 ? 0 : '24px'}>
            {item.title && (
              <Text typography="Body2Strong">
                {intl.formatMessage({ id: item.title })}
              </Text>
            )}
            {item.description ? (
              <Text typography="Body2" color="text-subdued" mt="8px">
                {intl.formatMessage({
                  id: item.description,
                })}
              </Text>
            ) : (
              <Pressable mx={-2} mt="8px" onPress={onPressDrawerTrigger}>
                {({ isHovered, isPressed }) => (
                  <Box
                    flexDir="row"
                    py={{ base: '12px', sm: '8px' }}
                    px="8px"
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
                    <Text flex={1} typography="Body2Strong" ml="12px">
                      MetaMask
                    </Text>
                    <Icon
                      name="ChevronRightMini"
                      color="icon-subdued"
                      size={20}
                    />
                  </Box>
                )}
              </Pressable>
            )}
          </Box>
        ))}
      </Box>
    </>
  );
};

SecondaryContent.defaultProps = defaultProps;

export default SecondaryContent;
