import { createContext, memo, useContext, useEffect, useMemo } from 'react';

import { Dialog as TMDialog } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IconButton } from '../../actions/IconButton';
import { Icon, SizableText, Stack } from '../../primitives';

import type { IDialogHeaderContextType, IDialogHeaderProps } from './type';
import type { ColorTokens, ISizableTextProps } from '../../primitives';

export const DialogHeaderContext = createContext<IDialogHeaderContextType>(
  {} as IDialogHeaderContextType,
);

export function DialogIcon({
  icon,
  tone,
}: {
  icon: IDialogHeaderProps['icon'];
  tone?: IDialogHeaderProps['tone'];
}) {
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
  return icon ? (
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
  ) : null;
}

export function DialogTitle({ children, ...props }: ISizableTextProps) {
  return (
    <>
      <SizableText m="$5" mb={0} mr="$16" size="$headingXl" py="$px" {...props}>
        {children}
      </SizableText>
      {
        /* fix missing title warnings in html dialog element on Web */
        platformEnv.isRuntimeBrowser ? (
          <TMDialog.Title display="none">{children}</TMDialog.Title>
        ) : null
      }
    </>
  );
}

export function DialogDescription(props: ISizableTextProps) {
  return <SizableText m="$5" mr="$16" size="$bodyLg" mt="$1.5" {...props} />;
}

function BasicDialogHeader({ onClose }: { onClose: () => void }) {
  const { headerProps } = useContext(DialogHeaderContext);
  const {
    icon,
    title,
    description,
    showExitButton = true,
    tone,
    children,
  } = headerProps;

  return (
    <>
      {children || (
        <>
          {/* leading icon */}
          <DialogIcon icon={icon} tone={tone} />
          {/* title and description */}
          {title || description ? (
            <>
              {title ? <DialogTitle>{title}</DialogTitle> : null}
              {description ? (
                <DialogDescription>{description}</DialogDescription>
              ) : null}
            </>
          ) : null}
        </>
      )}

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
