import type { ComponentProps, FC, ReactNode } from 'react';
import { isValidElement } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import Box from '../Box';
import Button from '../Button';
import Center from '../Center';
import Icon from '../Icon';
import Image from '../Image';
import Text from '../Text';

import type { ICON_NAMES } from '../Icon/Icons';

type BoxProps = ComponentProps<typeof Box>;
type NonString<T> = T extends string ? never : T;
type EmptyProps = {
  title: string;
  subTitle?: string | ReactNode;
  // ref: https://github.com/microsoft/TypeScript/issues/29729#issuecomment-567871939
  // HACK: to let icon has the ICON_NAMES lookup and supports ReactNode
  icon?: ICON_NAMES | NonString<ReactNode>;
  actionTitle?: string;
  imageUrl?: number;
  emoji?: string;
  actionProps?: ComponentProps<typeof Button>;
  handleAction?: () => void;
  isLoading?: boolean;
} & BoxProps;

function renderIcon(icon: EmptyProps['icon']) {
  if (icon === null) {
    return null;
  }
  if (isValidElement(icon)) {
    return icon;
  }
  return (
    <Box p={4} mb={4} bgColor="surface-neutral-default" rounded="full">
      <Icon
        name={(icon as ICON_NAMES) ?? 'InboxOutline'}
        size={32}
        color="icon-subdued"
      />
    </Box>
  );
}

const Empty: FC<EmptyProps> = ({
  title,
  subTitle,
  icon,
  actionTitle,
  imageUrl,
  emoji,
  handleAction,
  actionProps,
  isLoading,
  ...rest
}) => {
  const isSmallScreen = useIsVerticalLayout();

  return (
    <Box width="100%" flexDirection="row" justifyContent="center" {...rest}>
      <Center flex={1} py="4">
        {!!icon && renderIcon(icon)}
        {!!imageUrl && (
          <Box mb={3}>
            <Image size="100px" source={imageUrl} />
          </Box>
        )}
        {!!emoji && (
          <Text fontSize={56} mb={3} lineHeight="70px">
            {emoji}
          </Text>
        )}
        <Text
          typography={{ sm: 'DisplayMedium', md: 'DisplaySmall' }}
          textAlign="center"
        >
          {title}
        </Text>
        <Text
          textAlign="center"
          typography={{ sm: 'Body1', md: 'Body2' }}
          color="text-subdued"
          mt={2}
        >
          {subTitle}
        </Text>
        {!!handleAction && (
          <Button
            isLoading={isLoading}
            mt={6}
            type="primary"
            onPress={handleAction}
            size={isSmallScreen ? 'lg' : 'base'}
            {...actionProps}
          >
            {actionTitle}
          </Button>
        )}
      </Center>
    </Box>
  );
};

export default Empty;
