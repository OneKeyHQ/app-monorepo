import type { ComponentProps } from 'react';
import {
  type FC,
  cloneElement,
  useCallback,
  useContext,
  useState,
} from 'react';

import { StyleSheet } from 'react-native';
import { createStyledContext, styled } from 'tamagui';

import { Button } from '../Button';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Stack, XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type { ColorTokens } from 'tamagui';

type AlertType = 'info' | 'warning' | 'critical' | 'success' | 'default';

type AlertActionProps = {
  primary: string;
  onPrimaryPress?: () => void;
  secondary?: string;
  onSecondaryPress?: () => void;
};

const AlertContext = createStyledContext<{
  type: AlertType;
}>({
  type: 'default',
});

type AlertProps = {
  type?: AlertType;
  title: string;
  description: string;
  closable?: boolean;
  icon?: ComponentProps<typeof Icon>['name'];
  action?: AlertActionProps;
};

const AlertFrame = styled(XStack, {
  name: 'Alert',
  context: AlertContext,
  paddingHorizontal: '$4',
  paddingVertical: '$3.5',
  alignItems: 'flex-start',
  space: '$2',
  backgroundColor: '$bgSubdued',
  borderColor: '$borderSubdued',
  borderRadius: '$3',
  borderWidth: StyleSheet.hairlineWidth,
  variants: {
    type: {
      info: {
        backgroundColor: '$bgInfoSubdued',
        borderColor: '$borderInfoSubdued',
      },
      warning: {
        backgroundColor: '$bgCautionSubdued',
        borderColor: '$borderCautionSubdued',
      },
      critical: {
        backgroundColor: '$bgCriticalSubdued',
        borderColor: '$borderCriticalSubdued',
      },
      success: {
        backgroundColor: '$bgSuccessSubdued',
        borderColor: '$borderSuccessSubdued',
      },
      default: {
        backgroundColor: '$bgSubdued',
        borderColor: '$borderSubdued',
      },
    },
  },
});

const AlertIcon = (props: { children: any }) => {
  const { type } = useContext(AlertContext);
  const colorMapping: Record<AlertType, ColorTokens> = {
    default: '$iconSubdued',
    info: '$iconInfo',
    warning: '$iconCaution',
    critical: '$iconCritical',
    success: '$iconSuccess',
  };
  return cloneElement(props.children, {
    color: colorMapping[type],
  });
};

export const Alert: FC<AlertProps> = ({
  icon,
  title,
  description,
  closable,
  type,
  action,
}) => {
  const [show, setShow] = useState(true);
  const onClose = useCallback(() => setShow(false), []);
  if (!show) {
    return null;
  }
  return (
    <AlertFrame type={type}>
      {icon ? (
        <Stack>
          <AlertIcon>
            <Icon name={icon} size="$5" />
          </AlertIcon>
        </Stack>
      ) : null}
      <YStack flex={1} space="$1">
        <Text variant="$bodyMdMedium">{title}</Text>
        <Text variant="$bodyMd" color="$textSubdued">
          {description}
        </Text>
        {action ? (
          <XStack pt="$2" space="$4" alignItems="center">
            <Button
              size="small"
              buttonVariant="secondary"
              onPress={action.onPrimaryPress}
            >
              <Button.Text>{action.primary}</Button.Text>
            </Button>
            {action.secondary ? (
              <Button
                size="small"
                buttonVariant="tertiary"
                onPress={action.onSecondaryPress}
              >
                <Button.Text> {action.secondary}</Button.Text>
              </Button>
            ) : null}
          </XStack>
        ) : null}
      </YStack>
      {closable ? (
        <IconButton size="small" buttonVariant="tertiary" onPress={onClose}>
          <IconButton.Icon name="CrossedSmallSolid" />
        </IconButton>
      ) : null}
    </AlertFrame>
  );
};
