import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Center, Text, useSafeAreaInsets } from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

const TermsOfService: FC = () => {
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

  const agreementText = useCallback(
    (text) => (
      <Text
        color="text-subdued"
        onPress={onOpenUserAgreement}
        typography="CaptionUnderline"
      >
        {text}
      </Text>
    ),
    [onOpenUserAgreement],
  );
  const policyText = useCallback(
    (text) => (
      <Text
        color="text-subdued"
        onPress={onOpenPrivacyPolicy}
        typography="CaptionUnderline"
      >
        {text}
      </Text>
    ),
    [onOpenPrivacyPolicy],
  );

  return (
    <Center
      position="absolute"
      bottom={{ base: `${insets.bottom}px`, sm: 8 }}
      w="full"
      pb="16px"
      bgColor="background-default"
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
            a: agreementText,
            b: policyText,
          },
        )}
      </Text>
    </Center>
  );
};

export default TermsOfService;
