import { createContext, memo, useContext, useEffect, useMemo } from 'react';

import { IconButton } from '../../actions/IconButton';
import { Icon, SizableText, Stack } from '../../primitives';

import type {
  IDialogTitleContextTitleProps,
  IDialogTitleContextType,
} from './type';
import type { ColorTokens } from '../../primitives';

export const DialogTitleContext = createContext<IDialogTitleContextType>(
  {} as IDialogTitleContextType,
);

function BasicDialogTitle({ onClose }: { onClose: () => void }) {
  const { titleProps } = useContext(DialogTitleContext);
  const { icon, title, description, showExitButton, tone } = titleProps;

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
    </>
  );
}

export const DialogTitle = memo(BasicDialogTitle);

function BasicSetDialogTitle(props: IDialogTitleContextTitleProps) {
  const { setTitleProps } = useContext(DialogTitleContext);
  useEffect(() => {
    setTitleProps(props);
  }, [props, setTitleProps]);
  return null;
}

export const SetDialogTitle = memo(BasicSetDialogTitle);
