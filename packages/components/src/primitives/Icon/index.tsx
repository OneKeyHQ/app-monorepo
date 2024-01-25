import { Suspense, forwardRef } from 'react';

import { styled, withStaticProperties } from 'tamagui';

import { createSuspender } from '@onekeyhq/shared/src/modules3rdParty/use-suspender';

import { useThemeValue } from '../../hooks/useStyle';
import { View } from '../../optimization';

import ICON_CONFIG from './Icons';

import type { IKeyOfIcons } from './Icons';
import type { TextStyle } from 'react-native';
import type { Svg, SvgProps } from 'react-native-svg';
import type { GetProps } from 'tamagui';

export type IIconContainerProps = Omit<SvgProps, 'color' | 'style'> & {
  name?: IKeyOfIcons;
  style?: TextStyle;
};

const ComponentMaps: Record<string, typeof Svg> = {};

const DEFAULT_SIZE = 24;

const loadIcon = (name: IKeyOfIcons) =>
  new Promise<typeof Svg>((resolve) => {
    void ICON_CONFIG[name]().then((module: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ComponentMaps[name] = module.default as typeof Svg;
      resolve(ComponentMaps[name]);
    });
  });

// eslint-disable-next-line @typescript-eslint/unbound-method
const { useSuspender } = createSuspender(
  (name: IKeyOfIcons) =>
    new Promise<typeof Svg>((resolve) => {
      if (ComponentMaps[name]) {
        resolve(ComponentMaps[name]);
      } else {
        void loadIcon(name).then(resolve);
      }
    }),
);

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
  const SVGComponent = useSuspender(name);
  return <SVGComponent {...props} />;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BasicIconContainer({ name, style }: IIconContainerProps, _: any) {
  const defaultColor = useThemeValue('icon');
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
    <Suspense
      fallback={
        <View
          style={{
            width: componentWidth,
            height: componentHeight,
          }}
        />
      }
    >
      <IconLoader
        width={componentWidth}
        height={componentHeight}
        style={style}
        color={componentColor}
        name={name}
      />
    </Suspense>
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
        type SizeType = keyof typeof tokens.size;
        const size = tokens.size[rawSize as SizeType].val;
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
export type IIconProps = GetProps<typeof Icon> & IIconContainerProps;
