import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, IconButton, Text } from '@onekeyhq/components';
import { useSafeAreaInsets } from '@onekeyhq/components/src/Provider/hooks';
import { useHelpLink } from '@onekeyhq/kit/src/hooks';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import Welcome from './Welcome';

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

  return (
    <Center flex={1} px={6} pb={4 + insets.bottom} bgColor="background-default">
      {/* Close button */}
      <IconButton
        position="absolute"
        top={{ base: 4 + insets.top, sm: 8 }}
        right={{ base: 4, sm: 8 }}
        type="plain"
        size="lg"
        name="CloseOutline"
        circle
      />
      {/* Content */}
      <Box w="full" maxW={800}>
        <Welcome />
      </Box>
      {/* Agreement and privacy */}
      <Center
        position="absolute"
        w="full"
        bottom={{ base: 4 + insets.bottom, sm: 8 }}
      >
        <Text
          maxW={{ base: '300px', sm: 'auto' }}
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
