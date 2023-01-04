import type { FC } from 'react';

import Box from '../../Box';
import Center from '../../Center';
import Icon from '../../Icon';
import Text from '../../Text';

import type { ICON_NAMES } from '../../Icon';

export type IconType = 'danger' | 'info' | 'success' | 'warning';

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
   * Set the custom icon
   */
  iconName?: ICON_NAMES;
  /**
   * 标题
   */
  title?: string;
  /**
   * 内容
   */
  content?: string;
  contentElement?: JSX.Element;
  /**
   * Input
   */
  input?: JSX.Element;
};

const getIconBgColor = (iconType: IconType) => {
  switch (iconType) {
    case 'success':
      return 'decorative-surface-one';
    case 'warning':
      return 'surface-warning-default';
    case 'danger':
      return 'surface-critical-default';
    case 'info':
      return 'surface-neutral-default';
    default:
      return undefined;
  }
};

const getIconColor = (iconType: IconType) => {
  switch (iconType) {
    case 'success':
      return 'decorative-icon-one';
    case 'warning':
      return 'icon-warning';
    case 'danger':
      return 'icon-critical';
    case 'info':
      return 'icon-default';
    default:
      return undefined;
  }
};

const getIcon = (iconType: IconType, iconName?: ICON_NAMES) => {
  let icon = iconName;
  if (!icon) {
    if (iconType === 'success') {
      icon = 'CheckCircleOutline';
    }
    if (iconType === 'danger') {
      icon = 'ExclamationTriangleOutline';
    }
    if (iconType === 'warning') {
      icon = 'ExclamationTriangleOutline';
    }
    if (iconType === 'info') {
      icon = 'InformationCircleOutline';
    }
  }

  return (
    !!icon && (
      <Center p={3} mb={4} rounded="full" bgColor={getIconBgColor(iconType)}>
        <Icon name={icon} size={24} color={getIconColor(iconType)} />
      </Center>
    )
  );
};

const Content: FC<ContentProps> = ({
  icon,
  iconType,
  iconName,
  title,
  content,
  contentElement,
  input,
}) => (
  <Box flexDirection="column" w="100%" alignItems="center">
    {!!(icon || iconType || iconName) &&
      (iconType ? getIcon(iconType, iconName) : <Box mb={5}>{icon}</Box>)}
    {!!title && (
      <Text
        typography={{ sm: 'DisplayMedium', md: 'Heading' }}
        color="text-default"
        textAlign="center"
      >
        {title}
      </Text>
    )}

    {contentElement}

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
