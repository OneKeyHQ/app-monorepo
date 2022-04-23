import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Button } from 'native-base';
import { useIntl } from 'react-intl';

import {
  HStack,
  Icon,
  Modal,
  Pressable,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScanQrcodeRoutes, ScanQrcodeRoutesParams } from './types';

const { isWeb, isNative: isApp } = platformEnv;
const pressableProps = {
  p: '4',
  bg: 'surface-default',
  borderRadius: '12px',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  shadow: 'depth.2',
};
type ScanQrcodeResultRouteProp = RouteProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcodeResult
>;
const ScanQrcodeResult: FC = () => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const route = useRoute<ScanQrcodeResultRouteProp>();
  const { type, data } = route.params;
  let header = intl.formatMessage({ id: 'title__qr_code_info' });
  if (type === 'address') {
    header = intl.formatMessage({ id: 'form__address' });
  } else if (type === 'url') {
    header = intl.formatMessage({ id: 'title__url' });
  }
  return (
    <Modal hidePrimaryAction hideSecondaryAction header={header}>
      <Pressable>
        <HStack space="4">
          <Icon name="CompassOutline" />
          <Typography.Body1>
            {intl.formatMessage({
              id: 'form__view_in_explore',
            })}
          </Typography.Body1>
        </HStack>
        <Icon name="ChevronRightSolid" size={20} />
      </Pressable>
    </Modal>
  );
};

export default ScanQrcodeResult;
