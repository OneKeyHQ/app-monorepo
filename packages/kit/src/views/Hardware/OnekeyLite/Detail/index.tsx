import React, { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Button,
  Icon,
  Pressable,
  useLocale,
  useToast,
} from '@onekeyhq/components';

import { useNavigation } from '../../../..';
import WebView from '../../../../components/WebView';

export type OnekeyLiteDetailViewProps = {
  liteId: string;
};

const OnekeyLiteDetail: React.FC<OnekeyLiteDetailViewProps> = ({ liteId }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { locale } = useLocale();
  const url = `https://lite.onekey.so/?language=${locale}`;
  const toast = useToast();

  const onClick = useCallback(() => {
    toast.show({
      title: intl.formatMessage({ id: 'msg__coming_soon' }),
    });
  }, [intl, toast]);

  useEffect(() => {
    console.log(liteId);
  }, [liteId]);

  navigation.setOptions({
    title: 'OneKey Lite',
    headerRight: () => (
      <Pressable onPress={onClick}>
        <Icon name="DotsHorizontalOutline" />
      </Pressable>
    ),
  });

  return (
    <Box flexDirection="column" flex={1}>
      <Box flex={1}>
        <WebView src={url} />
      </Box>

      <Box>
        <Button
          onPress={onClick}
          size="lg"
          mx={4}
          mt={4}
          mb={Platform.OS === 'ios' ? 8 : 4}
          type="primary"
        >
          {intl.formatMessage({ id: 'msg__coming_soon' })}
        </Button>
      </Box>
    </Box>
  );
};

export default OnekeyLiteDetail;
