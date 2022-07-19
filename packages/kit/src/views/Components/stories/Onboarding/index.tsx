import React, { FC, useCallback } from 'react';

import { IBoxProps } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Hidden,
  ICON_NAMES,
  Icon,
  IconButton,
  Pressable,
  Text,
} from '@onekeyhq/components';
import { useSafeAreaInsets } from '@onekeyhq/components/src/Provider/hooks';
import { useHelpLink } from '@onekeyhq/kit/src/hooks';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

const OnboardingGallery = () => {
  const intl = useIntl();
  const insets = useSafeAreaInsets();

  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });

  const onOpenUserAgreement = useCallback(() => {
    openUrl(
      userAgreementUrl,
      intl.formatMessage({
        id: 'form__user_agreement',
      }),
    );
  }, [intl, userAgreementUrl]);

  const onOpenPrivacyPolicy = useCallback(() => {
    openUrl(
      privacyPolicyUrl,
      intl.formatMessage({
        id: 'form__privacy_policy',
      }),
    );
  }, [intl, privacyPolicyUrl]);

  type PressableListItemProps = {
    icon: ICON_NAMES;
    label: string;
  } & IBoxProps;

  const PressableListItem: FC<PressableListItemProps> = ({
    icon,
    label,
    ...rest
  }) => (
    <Pressable
      flexDir="row"
      p={4}
      bgColor="surface-default"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      borderWidth={1}
      borderColor="divider"
      rounded="xl"
      {...rest}
    >
      <Icon name={icon} color="interactive-default" />
      <Text
        flex={1}
        mx={3}
        typography={{ sm: 'Body1Strong', md: 'DisplayMedium' }}
      >
        {label}
      </Text>
      <Icon name="ChevronRightSolid" />
    </Pressable>
  );

  return (
    <Center flex={1} px={6} pb={4 + insets.bottom} bgColor="background-default">
      {/* Close button */}
      <IconButton
        position="absolute"
        top={4 + insets.top}
        right={4}
        type="plain"
        size="lg"
        name="CloseOutline"
        circle
      />
      {/* Content */}
      <Box w="full" maxW={800}>
        <Icon name="BrandLogoIllus" size={48} />
        <Text typography={{ sm: 'DisplayXLarge', md: 'Display2XLarge' }} mt={6}>
          {intl.formatMessage({ id: 'onboarding__landing_welcome_title' })}
          {'\n'}
          <Text color="text-subdued">
            {intl.formatMessage({ id: 'onboarding__landing_welcome_desc' })}
          </Text>
        </Text>
        <Box mt={16} flexDirection={{ md: 'row' }}>
          <PressableListItem
            icon="PlusCircleOutline"
            label={intl.formatMessage({
              id: 'action__create_wallet',
            })}
            borderBottomRadius={0}
          />
          <PressableListItem
            icon="SaveOutline"
            label={intl.formatMessage({
              id: 'action__import_wallet',
            })}
            borderTopRadius={0}
            mt="-1px"
          />
          <Box mt={8}>
            <PressableListItem
              icon="ConnectOutline"
              label={intl.formatMessage({
                id: 'action__connect_wallet',
              })}
            />
          </Box>
        </Box>
        <Hidden from="md">
          <Text color="text-subdued" typography="Body2" mt={3}>
            {intl.formatMessage({ id: 'content__supported_wallets' })}
          </Text>
        </Hidden>
      </Box>
      {/* Agreement and privacy */}
      <Center position="absolute" w="full" bottom={4 + insets.bottom}>
        <Text
          maxW="300px"
          mx="auto"
          textAlign="center"
          color="text-subdued"
          typography="Caption"
        >
          {intl.formatMessage(
            { id: 'content__agree_to_user_agreement_and_privacy_policy' },
            {
              a: (text) => (
                <Text
                  color="text-subdued"
                  onPress={onOpenUserAgreement}
                  typography="CaptionUnderline"
                >
                  {text}
                </Text>
              ),
              b: (text) => (
                <Text
                  color="text-subdued"
                  onPress={onOpenPrivacyPolicy}
                  typography="CaptionUnderline"
                >
                  {text}
                </Text>
              ),
            },
          )}
        </Text>
      </Center>
    </Center>
  );
};

export default OnboardingGallery;
