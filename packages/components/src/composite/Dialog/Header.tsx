import { createContext, memo, useContext, useEffect, useMemo } from 'react';

import { Dialog as TMDialog } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions/IconButton';
import { Icon, SizableText, Stack } from '../../primitives';

import type { IDialogHeaderContextType, IDialogHeaderProps } from './type';
import type { ColorTokens } from '../../primitives';

export const DialogHeaderContext = createContext<IDialogHeaderContextType>(
  {} as IDialogHeaderContextType,
);

function BasicDialogHeader({ onClose }: { onClose: () => void }) {
  const { headerProps } = useContext(DialogHeaderContext);
  const { icon, title, description, showExitButton = true, tone } = headerProps;

  const colors: {
    iconWrapperBg: ColorTokens;
    iconColor: ColorTokens;
  } = useMemo(() => {
    switch (tone) {
      case 'destructive': {
        return {
          iconWrapperBg: '$bgCritical',
          iconColor: '$iconCritical',
        };
      }
      case 'warning': {
        return {
          iconWrapperBg: '$bgCaution',
          iconColor: '$iconCaution',
        };
      }
      case 'success': {
        return {
          iconWrapperBg: '$bgSuccess',
          iconColor: '$iconSuccess',
        };
      }
      default: {
        return {
          iconWrapperBg: '$bgStrong',
          iconColor: '$icon',
        };
      }
    }
  }, [tone]);
  return (
    <>
      {/* leading icon */}
      {icon ? (
        <Stack
          alignSelf="flex-start"
          p="$3"
          ml="$5"
          mt="$5"
          borderRadius="$full"
          bg={colors.iconWrapperBg}
        >
          <Icon name={icon} size="$8" color={colors.iconColor} />
        </Stack>
      ) : null}

      {/* title and description */}
      {title || description ? (
        <Stack p="$5" pr="$16">
          {title ? (
            <SizableText size="$headingXl" py="$px">
              {title}
            </SizableText>
          ) : null}
          {description ? (
            <SizableText size="$bodyLg" pt="$1.5">
              {description}
            </SizableText>
          ) : null}
        </Stack>
      ) : null}

      {/* close button */}
      {showExitButton ? (
        <IconButton
          position="absolute"
          zIndex={1}
          right="$5"
          top="$5"
          icon="CrossedSmallOutline"
          iconProps={{
            color: '$iconSubdued',
          }}
          size="small"
          onPress={onClose}
        />
      ) : null}
      {
        /* fix missing title warnings in html dialog element on Web */
        platformEnv.isRuntimeBrowser ? (
          <TMDialog.Title display="none">{title}</TMDialog.Title>
        ) : null
      }
    </>
  );
}

export const DialogHeader = memo(BasicDialogHeader);

function BasicSetDialogHeader(props: IDialogHeaderProps) {
  const { setHeaderProps } = useContext(DialogHeaderContext);
  useEffect(() => {
    setHeaderProps(props);
  }, [props, setHeaderProps]);
  return null;
}

export const SetDialogHeader = memo(BasicSetDialogHeader);
