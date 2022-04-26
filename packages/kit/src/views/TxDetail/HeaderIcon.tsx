import React, { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Center,
  ICON_NAMES,
  Icon,
  Image,
  Typography,
} from '@onekeyhq/components';
import { ThemeValues } from '@onekeyhq/components/src/Provider/theme';
import { TxStatus } from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';

import { Token } from '../../store/typings';

const getHeaderIconInfo = (
  headerInfo:
    | Network
    | TxStatus
    | Token
    | { iconUrl: string; iconName: string },
) => {
  let isStatus = false;
  let statusTitle:
    | 'transaction__failed'
    | 'transaction__pending'
    | 'transaction__success' = 'transaction__failed';
  let statusIconName: ICON_NAMES = 'CloseCircleOutline';
  let iconColor: keyof ThemeValues = 'icon-critical';
  let iconContainerColor = 'surface-critical-default';
  let textColor = 'text-critical';

  let iconUrl = '';
  let iconName = '';

  if (typeof headerInfo === 'string') {
    // Trascation status
    isStatus = true;
    const status = headerInfo;

    switch (status) {
      case TxStatus.Pending:
        statusTitle = 'transaction__pending';
        statusIconName = 'DotsCircleHorizontalOutline';
        iconColor = 'icon-warning';
        textColor = 'text-warning';
        iconContainerColor = 'surface-warning-default';
        break;
      case TxStatus.Confirmed:
        statusTitle = 'transaction__success';
        statusIconName = 'CheckCircleOutline';
        iconColor = 'icon-success';
        textColor = 'text-success';
        iconContainerColor = 'surface-success-default';
        break;
      default:
        break;
    }
  } else if ('iconUrl' in headerInfo) {
    // Custom header
    iconUrl = headerInfo.iconUrl;
    iconName = headerInfo.iconName;
    iconContainerColor = '';
    textColor = 'text-default';
  } else if ('tokenIdOnNetwork' in headerInfo) {
    // Toekn icon header
    const token = headerInfo;
    const { name, symbol, logoURI } = token;
    iconUrl = logoURI;
    iconName = `${symbol}(${name})`;
    iconContainerColor = '';
    textColor = 'text-default';
  } else {
    // Native currency symbol header
    const network = headerInfo;
    const { name, symbol, logoURI } = network;
    iconUrl = logoURI;
    iconName = `${symbol}(${name})`;
    iconContainerColor = '';
    textColor = 'text-default';
  }

  return {
    isStatus,
    statusTitle,
    statusIconName,
    iconColor,
    iconContainerColor,
    textColor,
    iconUrl,
    iconName,
  };
};

const HeaderIcon: FC<{
  headerInfo:
    | Network
    | TxStatus
    | Token
    | { iconUrl: string; iconName: string };
}> = ({ headerInfo }) => {
  const intl = useIntl();

  const {
    isStatus,
    statusTitle,
    statusIconName,
    iconColor,
    iconContainerColor,
    textColor,
    iconUrl,
    iconName,
  } = useMemo(() => getHeaderIconInfo(headerInfo), [headerInfo]);

  return (
    <Center>
      <Center rounded="full" size="56px" bgColor={iconContainerColor}>
        {isStatus ? (
          <Icon color={iconColor} name={statusIconName} />
        ) : (
          <Image src={iconUrl} width="56px" height="56px" borderRadius="full" />
        )}
      </Center>
      <Typography.Heading mt={2} color={textColor}>
        {isStatus ? intl.formatMessage({ id: statusTitle }) : iconName}
      </Typography.Heading>
    </Center>
  );
};

export default HeaderIcon;
