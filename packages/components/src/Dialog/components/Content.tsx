import React, { FC } from 'react';

import { Icon } from 'native-base';

import Box from '../../Box';
import {
  DialogIconTypeDanger,
  DialogIconTypeInfo,
} from '../../Icon/react/solid';
import { Text } from '../../Typography';

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
  /**
   * Input
   */
  input?: JSX.Element;
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

const Content: FC<ContentProps> = ({
  icon,
  iconType,
  title,
  content,
  input,
}) => (
  <Box flexDirection="column" w="100%" alignItems="center" mb={4}>
    {!!(icon || iconType) &&
      (iconType ? getIcon(iconType) : <Box mb={5}>{icon}</Box>)}
    {!!title && (
      <Text
        typography={{ sm: 'DisplayMedium', md: 'Heading' }}
        color="text-default"
        textAlign="center"
      >
        {title}
      </Text>
    )}

    {!!content && (
      <Text
        mt="2"
        typography={{ sm: 'Body1', md: 'Body2' }}
        color="text-subdued"
        textAlign="center"
      >
        {content}
      </Text>
    )}
    {input}
  </Box>
);

export default Content;
