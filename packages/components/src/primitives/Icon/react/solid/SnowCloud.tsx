import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSnowCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.5 3a6.5 6.5 0 0 0 0 13H16a5 5 0 1 0-.674-9.955c-.191.026-.36-.065-.426-.165A6.5 6.5 0 0 0 9.5 3M6 17a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2zm6 0a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2zm6 0a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2zm-9 2a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2zm6 0a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2z" />
  </Svg>
);
export default SvgSnowCloud;
