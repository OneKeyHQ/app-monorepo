import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompassCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm12.075-2.075-3.26.89-.89 3.26 3.26-.89.89-3.26Zm.318-2.16a1.5 1.5 0 0 1 1.841 1.842l-1.119 4.105a2 2 0 0 1-1.403 1.403l-4.105 1.12a1.5 1.5 0 0 1-1.842-1.842l1.12-4.105a2 2 0 0 1 1.403-1.403l4.105-1.12Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompassCircle;
