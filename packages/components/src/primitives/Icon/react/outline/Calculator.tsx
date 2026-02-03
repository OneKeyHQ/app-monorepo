import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalculator = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 9H6v11h12zM6 4v3h12V4zm14 16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    <Path d="M10.25 16.75a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m4.5 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m-4.5-4.5a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m4.5 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0M11 16.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0m4.5 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0m-4.5-4.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0m4.5 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0" />
  </Svg>
);
export default SvgCalculator;
