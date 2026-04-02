import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightRain = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m14.844 18.053-1.895 3.789-1.789-.895 1.895-3.789z" />
    <Path d="M9.5 3a6.5 6.5 0 0 1 5.536 3.093A5 5 0 1 1 16 16h-4.63l-1.42 2.842-1.79-.895.979-1.957A6.5 6.5 0 0 1 9.5 3" />
  </Svg>
);
export default SvgLightRain;
