import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeFullOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 20.928 5.746 17H1V7h4.746L13 3.07v17.857Zm6.778-16.706A10.97 10.97 0 0 1 23 12.001a10.97 10.97 0 0 1-3.222 7.778l-1.414-1.414A8.97 8.97 0 0 0 21 12.001a8.97 8.97 0 0 0-2.636-6.365z" />
    <Path d="M16.597 7.404a6.48 6.48 0 0 1 1.903 4.597 6.48 6.48 0 0 1-1.903 4.595l-1.414-1.414a4.48 4.48 0 0 0 1.317-3.181 4.48 4.48 0 0 0-1.317-3.183z" />
  </Svg>
);
export default SvgVolumeFullOn;
