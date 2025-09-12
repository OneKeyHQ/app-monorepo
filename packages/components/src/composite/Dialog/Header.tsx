import type { ComponentProps } from 'react';
import { createContext, memo, useContext, useEffect, useMemo } from 'react';

import type { IHyperlinkTextProps } from '@onekeyhq/kit/src/components/HyperlinkText';

import { IconButton } from '../../actions/IconButton';
import { RichSizeableText } from '../../content/RichSizeableText';
import { useSettingConfig } from '../../hocs/Provider/hooks/useProviderValue';
import { Heading, Icon, SizableText, Stack } from '../../primitives';

import type { IDialogHeaderContextType, IDialogHeaderProps } from './type';
import type { IRichSizeableTextProps } from '../../content/RichSizeableText';
import type { ColorTokens, ISizableTextProps } from '../../primitives';

export const DialogHeaderContext = createContext<IDialogHeaderContextType>(
  {} as IDialogHeaderContextType,
);

export function DialogIcon({
  icon,
  tone,
  renderIcon,
  ...stackProps
}: {
  icon: IDialogHeaderProps['icon'];
  tone?: IDialogHeaderProps['tone'];
  renderIcon?: IDialogHeaderProps['renderIcon'];
} & ComponentProps<typeof Stack>) {
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
      case 'info': {
        return {
          iconWrapperBg: '$bgInfoSubdued',
          iconColor: '$iconInfo',
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
  if (renderIcon) {
    return (
      <Stack alignSelf="flex-start" mb="$5" {...stackProps}>
        {renderIcon}
      </Stack>
    );
  }
  return icon ? (
    <Stack
      alignSelf="flex-start"
      p="$3"
      mb="$5"
      borderRadius="$full"
      bg={colors.iconWrapperBg}
      {...stackProps}
    >
      <Icon name={icon} size="$8" color={colors.iconColor} />
    </Stack>
  ) : null;
}

export function DialogTitle({ children, ...props }: ISizableTextProps) {
  return (
    <Heading size="$headingXl" py="$px" {...props}>
      {children}
    </Heading>
  );
}

export function DialogDescription(props: ISizableTextProps) {
  return <SizableText size="$bodyLg" mt="$1.5" {...props} />;
}

/**
 * @deprecated Use DialogHyperlinkTextDescription instead
 */
export function DialogRichDescription(props: IRichSizeableTextProps) {
  return <RichSizeableText size="$bodyLg" mt="$1.5" {...props} />;
}

export function DialogHyperlinkTextDescription(props: IHyperlinkTextProps) {
  const { HyperlinkText } = useSettingConfig();
  return HyperlinkText ? (
    <HyperlinkText size="$bodyLg" mt="$1.5" {...props} />
  ) : null;
}

function BasicDialogHeader({
  onClose,
  trackID,
}: {
  onClose: () => void;
  trackID?: string;
}) {
  const { headerProps } = useContext(DialogHeaderContext);
  const {
    icon,
    title,
    description,
    showExitButton = true,
    tone,
    children,
    renderIcon,
  } = headerProps;
  return (
    <Stack p="$5" pr="$16">
      {children || (
        <>
          {/* leading icon */}
          <DialogIcon icon={icon} tone={tone} renderIcon={renderIcon} />
          {/* title and description */}
          {title || description ? (
            <>
              {title ? <DialogTitle>{title}</DialogTitle> : null}
              {description ? (
                <DialogDescription mr={-44}>{description}</DialogDescription>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {/* close button */}
      {showExitButton ? (
        <IconButton
          trackID={trackID}
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
    </Stack>
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
