import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightRain = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m14.842 18.053-1.895 3.789-1.789-.895 1.895-3.789z" />
    <Path
      fillRule="evenodd"
      d="M9.5 3a6.5 6.5 0 0 1 5.535 3.093A5 5 0 1 1 16 16h-3.632l-1.42 2.842-1.79-.895.974-1.947H9.5a6.5 6.5 0 1 1 0-13m0 2a4.5 4.5 0 1 0 0 9H16a3 3 0 1 0-1.1-5.792l-.893.353-.389-.878A4.5 4.5 0 0 0 9.5 5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLightRain;
