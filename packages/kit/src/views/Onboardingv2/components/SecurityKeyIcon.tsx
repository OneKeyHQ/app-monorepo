import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { YStack, useTheme } from '@onekeyhq/components';

export type ISecurityKeyType = 'device' | 'cloud' | 'auth';

interface ISecurityKeyIconProps {
  type: ISecurityKeyType;
  size?: 'small' | 'medium' | 'large';
  muted?: boolean;
}

// Gradient color tokens for each key type
const GRADIENT_TOKEN_CONFIG: Record<
  ISecurityKeyType,
  {
    startColor: string;
    endColor: string;
  }
> = {
  device: {
    startColor: 'brand9',
    endColor: 'brand8',
  },
  cloud: {
    startColor: 'info8',
    endColor: 'info9',
  },
  auth: {
    startColor: 'purple8',
    endColor: 'purple9',
  },
};

// SVG path data for each icon
const ICON_PATHS: Record<ISecurityKeyType, string[]> = {
  device: [
    'M22 8.5C22 12.0899 19.0899 15 15.5 15C14.7504 15 14.0304 14.8731 13.3604 14.6396L11.5858 16.4142C11.2107 16.7893 10.702 17 10.1716 17H9.5C9.22386 17 9 17.2239 9 17.5V18.1716C9 18.702 8.78929 19.2107 8.41421 19.5858L7.87868 20.1213C7.31607 20.6839 6.55301 21 5.75736 21H4C3.44772 21 3 20.5523 3 20V18.2426C3 17.447 3.31607 16.6839 3.87868 16.1213L9.36037 10.6396C9.12689 9.96959 9 9.24962 9 8.5C9 4.91015 11.9101 2 15.5 2C19.0899 2 22 4.91015 22 8.5ZM17 8.5C17 9.32843 16.3284 10 15.5 10C14.6716 10 14 9.32843 14 8.5C14 7.67157 14.6716 7 15.5 7C16.3284 7 17 7.67157 17 8.5Z',
  ],
  cloud: [
    'M12 4a7 7 0 0 0-6.402 4.165A6.002 6.002 0 0 0 7 20h11a5 5 0 0 0 .941-9.912A7.001 7.001 0 0 0 12 4Z',
  ],
  auth: [
    'M2.12 6.209a3.96 3.96 0 0 0-.09.596C2 7.18 2 7.635 2 8.161v7.678c0 .527 0 .981.03 1.356.033.395.104.789.297 1.167a3 3 0 0 0 1.311 1.311c.378.193.772.264 1.167.296.375.031.83.031 1.356.031h11.677c.528 0 .982 0 1.357-.03.395-.033.789-.104 1.167-.297a3 3 0 0 0 1.311-1.311c.193-.378.264-.772.296-1.167.031-.375.031-.83.031-1.356V8.16c0-.527 0-.981-.03-1.356a3.96 3.96 0 0 0-.09-.596l-7.98 6.529a3 3 0 0 1-3.8 0l-7.98-6.53Z',
    'M20.74 4.557a3.002 3.002 0 0 0-.378-.23c-.378-.193-.772-.264-1.167-.296A17.9 17.9 0 0 0 17.839 4H6.16c-.527 0-.981 0-1.356.03-.395.033-.789.104-1.167.297a3 3 0 0 0-.379.23l8.108 6.633a1 1 0 0 0 1.266 0l8.108-6.633Z',
  ],
};

const SIZE_CONFIG = {
  small: 20,
  medium: 24,
  large: 32,
} as const;

export function SecurityKeyIcon({
  type,
  size = 'medium',
  muted = false,
}: ISecurityKeyIconProps) {
  const tokenConfig = GRADIENT_TOKEN_CONFIG[type];
  const paths = ICON_PATHS[type];
  const iconSize = SIZE_CONFIG[size];
  const gradientId = `gradient-${type}${muted ? '-muted' : ''}`;

  const theme = useTheme();
  // Resolve color tokens to actual color values
  const startColor = theme[tokenConfig.startColor as keyof typeof theme]?.val;
  const endColor = theme[tokenConfig.endColor as keyof typeof theme]?.val;
  const mutedStartColor = theme.neutral7.val;
  const mutedEndColor = theme.neutral8.val;

  const finalStartColor = muted ? mutedStartColor : startColor;
  const finalEndColor = muted ? mutedEndColor : endColor;

  return (
    <YStack w={iconSize} h={iconSize}>
      <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={finalStartColor} />
            <Stop offset="100%" stopColor={finalEndColor} />
          </LinearGradient>
        </Defs>
        {paths.map((pathData, index) => (
          <Path
            key={index}
            d={pathData}
            fill={`url(#${gradientId})`}
            fillRule="evenodd"
            clipRule="evenodd"
          />
        ))}
      </Svg>
    </YStack>
  );
}
