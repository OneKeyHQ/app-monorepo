import { cloneElement, useCallback, useContext, useState } from 'react';
import type { ComponentProps, FC } from 'react';

import { StyleSheet } from 'react-native';
import { createStyledContext, styled } from 'tamagui';

import { Button, Icon, Stack, Text, XStack, YStack } from '../../primitives';
import { IconButton } from '../IconButton';

import type { ColorTokens } from 'tamagui';

type IAlertType = 'info' | 'warning' | 'critical' | 'success' | 'default';

type IAlertActionProps = {
  primary: string;
  onPrimaryPress?: () => void;
  secondary?: string;
  onSecondaryPress?: () => void;
};

const AlertContext = createStyledContext<{
  type: IAlertType;
}>({
  type: 'default',
});

type IAlertProps = {
  type?: IAlertType;
  title: string;
  description: string;
  closable?: boolean;
  icon?: ComponentProps<typeof Icon>['name'];
  action?: IAlertActionProps;
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
  const colorMapping: Record<IAlertType, ColorTokens> = {
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

export const Alert: FC<IAlertProps> = ({
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
            <Button size="small" onPress={action.onPrimaryPress}>
              {action.primary}
            </Button>
            {action.secondary ? (
              <Button
                size="small"
                variant="tertiary"
                onPress={action.onSecondaryPress}
              >
                {action.secondary}
              </Button>
            ) : null}
          </XStack>
        ) : null}
      </YStack>
      {closable ? (
        <IconButton
          icon="CrossedSmallSolid"
          size="small"
          variant="tertiary"
          onPress={onClose}
        />
      ) : null}
    </AlertFrame>
  );
};
