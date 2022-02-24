import React, { FC, ReactNode, isValidElement } from 'react';

import Box from '../Box';
import Button from '../Button';
import Center from '../Center';
import Icon from '../Icon';
import { ICON_NAMES } from '../Icon/Icons';
import Typography from '../Typography';

type NonString<T> = T extends string ? never : T;
type EmptyProps = {
  title: string;
  subTitle?: string | ReactNode;
  // ref: https://github.com/microsoft/TypeScript/issues/29729#issuecomment-567871939
  // HACK: to let icon has the ICON_NAMES lookup and supports ReactNode
  icon?: ICON_NAMES | NonString<ReactNode>;
  actionTitle?: string;
  handleAction?: () => void;
};

function renderIcon(icon: EmptyProps['icon']) {
  if (icon === null) {
    return null;
  }
  if (isValidElement(icon)) {
    return icon;
  }
  return <Icon name={(icon as ICON_NAMES) ?? 'InboxOutline'} size={32} />;
}

const Empty: FC<EmptyProps> = ({
  title,
  subTitle,
  icon,
  actionTitle,
  handleAction,
}) => (
  <Box width="100%" display="flex" flexDirection="row" justifyContent="center">
    <Center width="320px" py="4">
      {renderIcon(icon)}
      <Typography.DisplayMedium my="3">{title}</Typography.DisplayMedium>
      <Typography.Body1 color="text-subdued" mb="3">
        {subTitle}
      </Typography.Body1>
      {!!handleAction && (
        <Button type="primary" onPress={handleAction}>
          {actionTitle}
        </Button>
      )}
    </Center>
  </Box>
);

export default Empty;
