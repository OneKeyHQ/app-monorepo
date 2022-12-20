import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Center, Icon, Image, Typography } from '@onekeyhq/components';
import type { ThemeValues } from '@onekeyhq/components/src/Provider/theme';
import { TxStatus } from '@onekeyhq/engine/src/types/covalent';
import type { Network } from '@onekeyhq/engine/src/types/network';

import type { Token } from '../../../store/typings';

const getHeaderIconInfo = (
  headerInfo:
    | Network
    | TxStatus
    | Token
    | { title: string; imageUrl?: string; iconName?: ICON_NAMES },
) => {
  let isStatus = false;
  let statusTitle:
    | 'transaction__failed'
    | 'transaction__pending'
    | 'transaction__dropped'
    | 'transaction__success' = 'transaction__failed';
  let statusIconName: ICON_NAMES = 'XCircleOutline';
  let iconColor: keyof ThemeValues = 'icon-critical';
  let iconContainerColor = 'surface-critical-default';
  let textColor = 'text-critical';

  let imageUrl = '';
  let title = '';
  let iconName;

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
      case TxStatus.Dropped:
        statusTitle = 'transaction__dropped';
        break;
      default:
        break;
    }
  } else if ('title' in headerInfo) {
    // Custom header
    imageUrl = headerInfo.imageUrl ?? '';
    iconName = headerInfo.iconName;
    title = headerInfo.title;
    iconContainerColor = '';
    textColor = 'text-default';
  } else if ('tokenIdOnNetwork' in headerInfo) {
    // Toekn icon header
    const token = headerInfo;
    const { name, symbol, logoURI } = token;
    imageUrl = logoURI;
    title = `${symbol}(${name})`;
    iconContainerColor = '';
    textColor = 'text-default';
  } else {
    // Native currency symbol header
    const network = headerInfo;
    const { name, symbol, logoURI } = network;
    imageUrl = logoURI;
    title = `${symbol}(${name})`;
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
    imageUrl,
    iconName,
    title,
  };
};

const HeaderIcon: FC<{
  headerInfo:
    | Network
    | TxStatus
    | Token
    | { title: string; imageUrl?: string; iconName?: ICON_NAMES };
}> = ({ headerInfo }) => {
  const intl = useIntl();

  const {
    isStatus,
    statusTitle,
    statusIconName,
    iconColor,
    iconContainerColor,
    textColor,
    imageUrl,
    iconName,
    title,
  } = useMemo(() => getHeaderIconInfo(headerInfo), [headerInfo]);

  const renderIcon = () => {
    if (iconName) {
      return <Icon color={iconColor} name={iconName} size={56} />;
    }
    return <Icon color={iconColor} name={statusIconName} />;
  };

  return (
    <Center>
      <Center rounded="full" size="56px" bgColor={iconContainerColor}>
        {isStatus || !!iconName ? (
          renderIcon()
        ) : (
          <Image
            src={imageUrl}
            width="56px"
            height="56px"
            borderRadius="full"
          />
        )}
      </Center>
      <Typography.Heading mt={2} color={textColor}>
        {isStatus ? intl.formatMessage({ id: statusTitle }) : title}
      </Typography.Heading>
    </Center>
  );
};

export default HeaderIcon;
