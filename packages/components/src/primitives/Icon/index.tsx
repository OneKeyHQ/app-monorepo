import { forwardRef, useEffect, useState } from 'react';

import {
  type GetProps,
  styled,
  useTheme,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';

import { OptimizationView } from '../../optimization';

import ICON_CONFIG from './Icons';

import type { IKeyOfIcons } from './Icons';
import type { TextStyle } from 'react-native';
import type { Svg, SvgProps } from 'react-native-svg';

export type IIconContainerProps = Omit<SvgProps, 'color' | 'style'> & {
  name?: IKeyOfIcons;
  style?: TextStyle;
};

const ComponentMaps: Record<string, typeof Svg> = {};

const DEFAULT_SIZE = 24;

// Global promise cache to ensure only one loading promise per icon
const isLoadingIcon: Record<string, boolean> = {};
// Callback queues for each icon
const callbackQueues: Record<
  string,
  Array<(component: typeof Svg) => void>
> = {};

const loadIconModule = (name: IKeyOfIcons): Promise<typeof Svg> => {
  return new Promise((resolveCallback) => {
    if (callbackQueues[name]) {
      callbackQueues[name].push(resolveCallback);
    } else {
      callbackQueues[name] = [resolveCallback];
    }

    if (isLoadingIcon[name]) {
      return;
    }

    isLoadingIcon[name] = true;
    void ICON_CONFIG[name]?.().then((module: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (module?.default) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const component = module.default as typeof Svg;
        ComponentMaps[name] = component;
        delete isLoadingIcon[name];

        const callbacks = callbackQueues[name] || [];
        callbacks.forEach((callback) => callback(component));

        delete callbackQueues[name];
      }
    });
  });
};

const loadIcon = (name: IKeyOfIcons) =>
  new Promise<typeof Svg>((resolve) => {
    // If component is already loaded, resolve immediately
    if (ComponentMaps[name]) {
      resolve(ComponentMaps[name]);
      return;
    }

    void loadIconModule(name).then(resolve);
  });

function IconLoader({
  name,
  ...props
}: {
  name: IKeyOfIcons;
  width: number;
  height: number;
  color: string;
  style?: TextStyle;
}) {
  const [, setCount] = useState(0);

  useEffect(() => {
    if (ComponentMaps[name]) {
      return;
    }
    void loadIcon(name).then(() => {
      setCount((prev) => prev + 1);
    });
  }, [name]);

  const Svg = ComponentMaps[name];
  return Svg ? (
    <Svg {...props} />
  ) : (
    <OptimizationView
      style={{
        width: props.width,
        height: props.height,
      }}
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BasicIconContainer({ name, style }: IIconContainerProps, _: any) {
  const theme = useTheme();
  const defaultColor = theme.icon.val;
  if (!name) {
    return null;
  }
  const primaryColor: string = (style?.color as string) || defaultColor;

  const Svg = ComponentMaps[name];

  const componentWidth = (style?.width as number) || DEFAULT_SIZE;
  const componentHeight = (style?.height as number) || DEFAULT_SIZE;
  const componentColor = primaryColor || defaultColor;
  return Svg ? (
    <Svg
      width={componentWidth}
      height={componentHeight}
      style={style}
      color={componentColor}
    />
  ) : (
    <IconLoader
      width={componentWidth}
      height={componentHeight}
      style={style}
      color={componentColor}
      name={name}
    />
  );
}
const IconContainer = forwardRef(BasicIconContainer);

const BasicIcon = styled(IconContainer, {
  variants: {
    color: {
      '...color': (color) => ({
        height: undefined,
        width: undefined,
        color,
      }),
    },
    size: {
      '...size': (rawSize, { tokens }) => {
        // In fact, you can simply assign 'rawSize' to 'width' or 'height' here.
        //
        // return {
        //   width: rawSize,
        //   height: rawSize,
        // }
        //
        // But the 'width' and 'height' attributes of SVG don't accept CSS variables,
        // so you have to manually retrieve the values."
        type IBasicIconSizeType = keyof typeof tokens.size;
        const size = tokens.size[rawSize as IBasicIconSizeType].val;
        return {
          width: size,
          height: size,
        };
      },
    },
  } as const,
});

const loadIcons = (...names: IKeyOfIcons[]) =>
  Promise.all(names.map((name) => loadIcon(name)));

export const Icon = withStaticProperties(BasicIcon, {
  prefetch: loadIcons,
});

export type { IKeyOfIcons };
export type IIconProps = Omit<GetProps<typeof Icon>, 'name' | 'style'> &
  IIconContainerProps;
