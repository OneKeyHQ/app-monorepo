import { forwardRef, useEffect, useMemo, useState } from 'react';

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
type IIconLoadResult = typeof Svg | undefined;

// Global promise cache to ensure only one loading promise per icon
const isLoadingIcon: Record<string, boolean> = {};
// Callback queues for each icon
const callbackQueues: Record<
  string,
  Array<(component: IIconLoadResult) => void>
> = {};

const resolveIconCallbacks = (
  name: IKeyOfIcons,
  component: IIconLoadResult,
) => {
  const callbacks = callbackQueues[name] || [];
  callbacks.forEach((callback) => callback(component));
  delete callbackQueues[name];
};

const loadIconModule = (name: IKeyOfIcons): Promise<IIconLoadResult> => {
  return new Promise((resolveCallback) => {
    const iconLoader = ICON_CONFIG[name];
    if (!iconLoader) {
      resolveCallback(undefined);
      return;
    }

    if (callbackQueues[name]) {
      callbackQueues[name].push(resolveCallback);
    } else {
      callbackQueues[name] = [resolveCallback];
    }

    if (isLoadingIcon[name]) {
      return;
    }

    isLoadingIcon[name] = true;
    void iconLoader()
      .then((module: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const component = module?.default as typeof Svg | undefined;
        if (component) {
          ComponentMaps[name] = component;
        }
        delete isLoadingIcon[name];
        resolveIconCallbacks(name, component);
      })
      .catch(() => {
        delete isLoadingIcon[name];
        resolveIconCallbacks(name, undefined);
      });
  });
};

const loadIcon = (name: IKeyOfIcons) =>
  new Promise<IIconLoadResult>((resolve) => {
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

  const placeholderStyle = useMemo(
    () => ({
      width: props.width,
      height: props.height,
    }),
    [props.width, props.height],
  );

  const Svg = ComponentMaps[name];
  return Svg ? (
    <Svg {...props} />
  ) : (
    <OptimizationView style={placeholderStyle} />
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

const CRITICAL_ICON_NAMES: IKeyOfIcons[] = [
  'ArrowTopOutline',
  'ArrowBottomOutline',
  'DotHorOutline',
  'SearchOutline',
  'BellOutline',
  'DotGridOutline',
];

const SWAP_COLD_START_ICON_NAMES: IKeyOfIcons[] = [
  'TradingViewCandlesOutline',
  'SliderHorOutline',
  'ClockTimeHistoryOutline',
  'InfoCircleSolid',
  'CrossedSmallSolid',
  'SwitchVerOutline',
  'AnonymousHiddenOutline',
];

const PERPS_COLD_START_ICON_NAMES: IKeyOfIcons[] = [
  'BookOpenOutline',
  'ChevronBottomOutline',
  'ChevronDownSmallOutline',
  'ChevronTriangleDownSmallSolid',
  'ClockTimeHistoryOutline',
  'Copy3Outline',
  'DownloadOutline',
  'OpenOutline',
  'SliderVerOutline',
  'TradingViewCandlesOutline',
];

const TAB_COLD_START_ICON_NAMES: IKeyOfIcons[] = [
  'CodeBracketsOutline',
  'CodeBracketsSolid',
  'CoinsOutline',
  'CoinsSolid',
  'CompassOutline',
  'CompassSolid',
  'GiftOutline',
  'GiftSolid',
  'PhoneOutline',
  'PhoneSolid',
  'SwitchHorOutline',
  'SwitchHorSolid',
  'TradeOutline',
  'TradeSolid',
  'TradingViewCandlesOutline',
  'TradingViewCandlesSolid',
  'Wallet4Outline',
  'Wallet4Solid',
];

const APP_COLD_START_ICON_NAMES = [
  ...new Set([
    ...CRITICAL_ICON_NAMES,
    ...SWAP_COLD_START_ICON_NAMES,
    ...PERPS_COLD_START_ICON_NAMES,
    ...TAB_COLD_START_ICON_NAMES,
  ]),
];

export const prefetchSwapColdStartIcons = () =>
  loadIcons(...SWAP_COLD_START_ICON_NAMES)
    .then(() => undefined)
    .catch(() => undefined);

/**
 * Pre-warm critical icon segment loading. Call at JS entry (before React mount)
 * so segments start loading early and icons are ready by first render.
 */
export function warmCriticalIcons() {
  for (const name of APP_COLD_START_ICON_NAMES) {
    if (!ComponentMaps[name] && ICON_CONFIG[name]) {
      void loadIcon(name);
    }
  }
}

export const Icon = withStaticProperties(BasicIcon, {
  prefetch: loadIcons,
});

export type { IKeyOfIcons };
export type IIconProps = Omit<GetProps<typeof Icon>, 'name' | 'style'> &
  IIconContainerProps;
