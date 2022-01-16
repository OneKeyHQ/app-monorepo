import React, { useCallback, useEffect } from 'react';

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
  const navigation = useNavigation();
  const { locale } = useLocale();
  const url = `https://lite.onekey.so/?language=${locale}`;
  const toast = useToast();

  const onClick = useCallback(() => {
    toast.show({
      title: '敬请期待',
    });
  }, [toast]);

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
        <Button onPress={onClick} size="lg" m={4} type="primary">
          敬请期待
        </Button>
      </Box>
    </Box>
  );
};

export default OnekeyLiteDetail;
