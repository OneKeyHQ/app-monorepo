import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSnowCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.01 19a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm6 0a1 1 0 1 1 0 2H15a1 1 0 1 1 0-2zm-9-2a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2zm6 0a1 1 0 1 1 0 2H12a1 1 0 1 1 0-2zm6 0a1 1 0 1 1 0 2H18a1 1 0 1 1 0-2z" />
    <Path
      fillRule="evenodd"
      d="M9.5 3a6.5 6.5 0 0 1 5.535 3.093A5 5 0 1 1 16 16H9.5a6.5 6.5 0 1 1 0-13m0 2a4.5 4.5 0 1 0 0 9H16a3 3 0 1 0-1.1-5.792l-.893.353-.389-.878A4.5 4.5 0 0 0 9.5 5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSnowCloud;
