import React, { FC } from 'react';

import { Icon } from 'native-base';

import Box from '../../Box';
import {
  DialogIconTypeDanger,
  DialogIconTypeInfo,
} from '../../Icon/react/solid';
import { useUserDevice } from '../../Provider/hooks';
import Typography from '../../Typography';

export type IconType = 'danger' | 'info';

export type ContentProps = {
  /**
   * 自定义展示内容
   */
  icon?: JSX.Element;
  /**
   * 默认类型的 Icon 展示
   */
  iconType?: IconType;
  /**
   * 标题
   */
  title?: string;
  /**
   * 内容
   */
  content?: string;
};

const getIcon = (iconType: IconType) => {
  let icon = null;
  if (iconType === 'danger') {
    icon = DialogIconTypeDanger;
  }
  if (iconType === 'info') {
    icon = DialogIconTypeInfo;
  }
  return !!icon && <Icon mb={4} as={icon} size={12} />;
};

const Content: FC<ContentProps> = ({ icon, iconType, title, content }) => {
  const { size } = useUserDevice();

  const isSmallScreen = ['SMALL', 'NORMAL'].includes(size);

  return (
    <Box flexDirection="column" w="100%" alignItems="center" mb={4}>
      {!!(icon || iconType) &&
        (iconType ? getIcon(iconType) : <Box mb={5}>{icon}</Box>)}
      {!!title && isSmallScreen ? (
        <Typography.DisplayMedium color="text-default">
          {title}
        </Typography.DisplayMedium>
      ) : (
        <Typography.Heading color="text-default">{title}</Typography.Heading>
      )}
      {!!content && isSmallScreen ? (
        <Typography.Body1 textAlign="center" mt={2} color="text-subdued">
          {content}
        </Typography.Body1>
      ) : (
        <Typography.Body2 textAlign="center" mt={2} color="text-subdued">
          {content}
        </Typography.Body2>
      )}
    </Box>
  );
};

export default Content;
