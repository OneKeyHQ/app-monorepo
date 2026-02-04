import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSnowCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.01 19a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm6 0a1 1 0 1 1 0 2H15a1 1 0 1 1 0-2zm-9-2a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2zm6 0a1 1 0 1 1 0 2H12a1 1 0 1 1 0-2zm6 0a1 1 0 1 1 0 2H18a1 1 0 1 1 0-2zM3 9.5a6.5 6.5 0 0 1 11.9-3.62c.066.1.235.19.425.165A5 5 0 1 1 16 16H9.5A6.5 6.5 0 0 1 3 9.5m2 0A4.5 4.5 0 0 0 9.5 14H16a3 3 0 1 0-.406-5.973c-.873.118-1.823-.24-2.355-1.032A4.5 4.5 0 0 0 5 9.5" />
  </Svg>
);
export default SvgSnowCloud;
