import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import { cloneElement, useCallback, useContext, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { createStyledContext, styled, useThemeName } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '../../primitives';
import { IconButton } from '../IconButton';

import type {
  IKeyOfIcons,
  ISizableTextProps,
  IStackProps,
  IYStackProps,
} from '../../primitives';
import type { ColorTokens } from 'tamagui';

export type IAlertType =
  | 'info'
  | 'warning'
  | 'critical'
  | 'success'
  | 'default'
  | 'danger'
  | 'caution';

type IAlertActionProps = {
  primary: string;
  onPrimaryPress?: () => void;
  secondary?: string;
  onSecondaryPress?: () => void;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isPrimaryDisabled?: boolean;
  isSecondaryDisabled?: boolean;
};

interface IAlertContext {
  type: IAlertType;
  fullBleed?: boolean;
}

const AlertContext = createStyledContext<IAlertContext>({
  type: 'default',
  fullBleed: false,
});

export type IAlertProps = PropsWithChildren<
  {
    type?: IAlertType;
    fullBleed?: boolean;
    title?: string;
    renderTitle?: (props: ISizableTextProps) => ReactElement;
    titleNumberOfLines?: number;
    description?: string;
    descriptionComponent?: React.ReactNode;
    closable?: boolean;
    onClose?: () => void;
    icon?: IKeyOfIcons;
    action?: IAlertActionProps;
  } & IStackProps
>;

const AlertFrame = styled(XStack, {
  name: 'Alert',
  context: AlertContext,
  paddingHorizontal: '$4',
  paddingVertical: '$3.5',
  alignItems: 'center',
  gap: '$2',
  backgroundColor: '$bgSubdued',
  borderColor: '$borderSubdued',
  borderRadius: '$3',
  borderWidth: StyleSheet.hairlineWidth,
  borderCurve: 'continuous',
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
      caution: {
        backgroundColor: '$bgSubdued',
        borderColor: '$borderSubdued',
      },
      critical: {
        backgroundColor: '$bgCriticalSubdued',
        borderColor: '$borderCriticalSubdued',
      },
      danger: {
        backgroundColor: '$bgCritical',
        borderColor: '$borderCritical',
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
    fullBleed: {
      true: {
        paddingHorizontal: '$5',
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderRadius: 0,
      },
    },
  },
});

const AlertIcon = (props: { children: any }) => {
  const styleContext = useContext(AlertContext as any);
  const { type } = styleContext as IAlertContext;
  const colorMapping: Record<IAlertType, ColorTokens> = {
    default: '$iconSubdued',
    info: '$iconInfo',
    warning: '$iconCaution',
    critical: '$iconCritical',
    danger: '$iconCritical',
    success: '$iconSuccess',
    caution: '$iconCritical',
  };
  return cloneElement(props.children, {
    color: colorMapping[type],
  });
};

export const Alert: ComponentType<IAlertProps> = AlertFrame.styleable<
  IAlertProps,
  any,
  any
>((props: IAlertProps, ref: any) => {
  const {
    icon,
    title,
    renderTitle,
    description,
    descriptionComponent,
    closable,
    type,
    fullBleed,
    titleNumberOfLines,
    action,
    onClose: onCloseProp,
    children,
    ...rest
  } = props;

  const [show, setShow] = useState(true);
  const onClose = useCallback(() => {
    setShow(false);
    onCloseProp?.();
  }, [onCloseProp]);

  const intl = useIntl();
  const isDanger = type === 'danger';
  const themeName = useThemeName() as 'light' | 'dark';
  const dangerTextColor =
    themeName === 'light' ? '$textOnBrightColor' : '$textOnColor';

  if (!show) return null;

  return (
    <AlertFrame
      ref={ref}
      type={type}
      fullBleed={fullBleed}
      {...(rest as IYStackProps)}
    >
      {icon ? (
        <Stack>
          <AlertIcon>
            <Icon name={icon} size="$5" />
          </AlertIcon>
        </Stack>
      ) : null}
      <YStack flex={1} gap="$1">
        {title ? (
          <SizableText
            size="$bodyMdMedium"
            color={isDanger ? dangerTextColor : undefined}
            {...(titleNumberOfLines
              ? { numberOfLines: titleNumberOfLines }
              : {})}
          >
            {title}
          </SizableText>
        ) : null}
        {renderTitle
          ? renderTitle({
              size: '$bodyMdMedium',
              color: isDanger ? dangerTextColor : undefined,
              ...(titleNumberOfLines
                ? { numberOfLines: titleNumberOfLines }
                : {}),
            })
          : null}
        {description ? (
          <SizableText
            size="$bodyMd"
            color={isDanger ? dangerTextColor : '$textSubdued'}
          >
            {description}
          </SizableText>
        ) : null}
        {descriptionComponent || null}

        {children || null}
      </YStack>
      {action ? (
        <XStack gap="$4" alignItems="center">
          <Button
            size="small"
            onPress={action.onPrimaryPress}
            loading={action.isPrimaryLoading}
            disabled={action.isPrimaryDisabled}
          >
            {action.primary}
          </Button>
          {action.secondary ? (
            <Button
              size="small"
              variant="tertiary"
              onPress={action.onSecondaryPress}
              loading={action.isSecondaryLoading}
              disabled={action.isSecondaryDisabled}
            >
              {action.secondary}
            </Button>
          ) : null}
        </XStack>
      ) : null}
      {closable ? (
        <IconButton
          title={intl.formatMessage({ id: ETranslations.explore_dismiss })}
          icon="CrossedSmallSolid"
          size="small"
          variant="tertiary"
          onPress={onClose}
        />
      ) : null}
    </AlertFrame>
  );
});
