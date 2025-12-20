import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSnowCloud = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0m9-2a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-3 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0M9.5 3a6.5 6.5 0 0 0 0 13H16a5 5 0 1 0-.674-9.955c-.191.026-.36-.065-.426-.165A6.5 6.5 0 0 0 9.5 3"
    />
  </Svg>
);
export default SvgSnowCloud;
