import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeFullOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 4a1 1 0 0 0-1.555-.832L5.697 7H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2.697l5.748 3.832A1 1 0 0 0 13 20zm5.364.223a1 1 0 0 1 1.414 0A10.97 10.97 0 0 1 23 12c0 3.037-1.232 5.789-3.222 7.778a1 1 0 1 1-1.414-1.414A8.97 8.97 0 0 0 21 12a8.97 8.97 0 0 0-2.636-6.364 1 1 0 0 1 0-1.414Z" />
    <Path d="M16.596 7.404a1 1 0 1 0-1.414 1.415A4.48 4.48 0 0 1 16.5 12a4.48 4.48 0 0 1-1.318 3.182 1 1 0 1 0 1.414 1.414A6.48 6.48 0 0 0 18.5 12a6.48 6.48 0 0 0-1.904-4.597Z" />
  </Svg>
);
export default SvgVolumeFullOn;
