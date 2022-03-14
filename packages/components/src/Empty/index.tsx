import React, { FC, ReactNode, isValidElement } from 'react';

import Box from '../Box';
import Button from '../Button';
import Center from '../Center';
import Icon from '../Icon';
import { ICON_NAMES } from '../Icon/Icons';
import Image from '../Image';
import { useIsVerticalLayout } from '../Provider/hooks';
import { Text } from '../Typography';

type NonString<T> = T extends string ? never : T;
type EmptyProps = {
  title: string;
  subTitle?: string | ReactNode;
  // ref: https://github.com/microsoft/TypeScript/issues/29729#issuecomment-567871939
  // HACK: to let icon has the ICON_NAMES lookup and supports ReactNode
  icon?: ICON_NAMES | NonString<ReactNode>;
  actionTitle?: string;
  imageUrl?: number;
  handleAction?: () => void;
};

function renderIcon(icon: EmptyProps['icon']) {
  if (icon === null) {
    return null;
  }
  if (isValidElement(icon)) {
    return icon;
  }
  return (
    <Box mb={3}>
      <Icon name={(icon as ICON_NAMES) ?? 'InboxOutline'} size={48} />
    </Box>
  );
}

const Empty: FC<EmptyProps> = ({
  title,
  subTitle,
  icon,
  actionTitle,
  imageUrl,
  handleAction,
}) => {
  const isSmallScreen = useIsVerticalLayout();

  return (
    <Box
      width="100%"
      display="flex"
      flexDirection="row"
      justifyContent="center"
    >
      <Center width="320px" py="4">
        {!!icon && renderIcon(icon)}
        {!!imageUrl && (
          <Box mb={3}>
            <Image size="100px" source={imageUrl} />
          </Box>
        )}
        <Text typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}>
          {title}
        </Text>
        <Text
          typography={{ sm: 'Body1', md: 'Body2' }}
          color="text-subdued"
          mt={2}
        >
          {subTitle}
        </Text>
        {!!handleAction && (
          <Button
            mt={6}
            type="primary"
            onPress={handleAction}
            size={isSmallScreen ? 'lg' : 'base'}
          >
            {actionTitle}
          </Button>
        )}
      </Center>
    </Box>
  );
};

export default Empty;
