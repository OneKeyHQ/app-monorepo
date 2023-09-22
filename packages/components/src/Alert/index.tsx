import type { ComponentProps } from 'react';
import { type FC, useContext, cloneElement } from 'react';


import { Stack, XStack, YStack, createStyledContext, styled, ColorTokens } from 'tamagui';

import { Button } from '../Button';
import { Icon } from '../Icon';
import { Text } from '../Text';

type AlertType = 'info' | 'warning' | 'critical' | 'success' | 'default';

type AlertActionProps = {
  title: string;
  description?: string;
  onPress?: () => void
}

const AlertContext = createStyledContext<{
  type: AlertType;
}>({
  type: 'default',
});

type AlertProps = {
  type?: AlertType;
  title: string;
  description: string;
  icon?: ComponentProps<typeof Icon>['name'];
  action?: AlertActionProps
};

const AlertFrame = styled(XStack, {
  name: 'Alert',
  context: AlertContext,
  paddingHorizontal: '$4',
  paddingVertical: '$3.5',
  backgroundColor: '$bgSubdued',
  borderColor: '$borderSubdued',
  borderRadius: '$radius.3',
  borderWidth: '$px',
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

export const Alert: FC<AlertProps> = ({ icon, title, description, type, action }) => (
  <AlertFrame space="$2" type={type}>
    {
      icon ? <Stack>
        <AlertIcon>
          <Icon name={icon} />
        </AlertIcon>
      </Stack> : null
    }
    <YStack space="$1">
      <Text variant="$bodyMdMedium">{title}</Text>
      <Text variant="$bodyMd" color="$textSubdued">
        {description}
      </Text>
      {
        action ? <XStack pt="$2" space="$4" alignItems="center">
          <Button size="small" buttonVariant="secondary" onPress={action.onPress}>
            <Button.Text>{action.title}</Button.Text>
          </Button>
          {
            action.description ? <Text variant="$bodyMdMedium" color="$textSubdued">
              {action.description}
            </Text> : null
          }
        </XStack> : null
      }
    </YStack>
  </AlertFrame>
);
