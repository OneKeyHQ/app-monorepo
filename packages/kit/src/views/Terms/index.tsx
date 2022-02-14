/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Icon,
  Image,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
// import { StackBasicRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes';
import { MiscModalRoutes } from '@onekeyhq/kit/src/routes/Modal/Misc';

import termsImg from '../../../assets/terms.png';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// type NavigationProps = NativeStackNavigationProp<
//   StackRoutesParams & { [MiscModalRoutes.CreateWhatWalletModal]: undefined },
//   StackBasicRoutes.SettingsScreen
// >;

const Terms = () => {
  const intl = useIntl();
  const navigation = useNavigation<any>();
  const userAgreementUrl = useHelpLink({ path: 'articles/360002014776' });
  const privacyPolicyUrl = useHelpLink({ path: 'articles/360002003315' });
  const openWebViewUrl = useCallback(
    (url: string, title?: string) => {
      if (['android', 'ios'].includes(Platform.OS)) {
        // navigation.navigate(StackBasicRoutes.WebviewScreen, {
        //   url,
        //   title,
        // });
      } else {
        window.open(url, '_blank');
      }
    },
    [navigation],
  );
  const onPrimaryActionPress = useCallback(() => {
    navigation.navigate(MiscModalRoutes.CreateWhatWalletModal);
  }, [navigation]);
  return (
    <Modal
      header={intl.formatMessage({
        id: 'terms__title',
        defaultMessage: 'Terms & Condition',
      })}
      hideSecondaryAction
      onPrimaryActionPress={onPrimaryActionPress}
      primaryActionTranslationId="action__accept"
    >
      <Box flexDirection="column" justifyItems="center" alignItems="center">
        <Image source={termsImg} width={100} height={122} />
        <Typography.Body1 textAlign="center" color="text-subdued" mt="4">
          {intl.formatMessage({
            id: 'terms__desc',
            defaultMessage:
              'Please review our User Agreement and Privacy Policy',
          })}
        </Typography.Body1>
        <Box w="full" mt={6}>
          <Pressable
            w="full"
            justifyContent="space-between"
            alignItems="center"
            p="4"
            flexDirection="row"
            bg="surface-default"
            borderRadius={12}
            mb="4"
            onPress={() => openWebViewUrl(userAgreementUrl)}
          >
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'form__user_agreement' })}
            </Typography.Body1Strong>
            <Icon name="ExternalLinkOutline" size={14} />
          </Pressable>
          <Pressable
            w="full"
            justifyContent="space-between"
            alignItems="center"
            p="4"
            flexDirection="row"
            bg="surface-default"
            borderRadius={12}
            onPress={() => openWebViewUrl(privacyPolicyUrl)}
          >
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'form__privacy_policy' })}
            </Typography.Body1Strong>
            <Icon name="ExternalLinkOutline" size={14} />
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
};

export default Terms;
