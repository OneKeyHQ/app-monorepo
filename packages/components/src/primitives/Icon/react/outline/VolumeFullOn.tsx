import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeFullOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.445 3.168A1 1 0 0 1 13 4v16a1 1 0 0 1-1.555.832L5.697 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.697zM21 12.001a8.97 8.97 0 0 0-2.636-6.364 1 1 0 1 1 1.414-1.414A10.97 10.97 0 0 1 23 12a10.97 10.97 0 0 1-3.222 7.778 1 1 0 0 1-1.414-1.415A8.97 8.97 0 0 0 21 12.001M16.5 12a4.48 4.48 0 0 0-1.318-3.182 1 1 0 0 1 1.415-1.414A6.48 6.48 0 0 1 18.5 12a6.48 6.48 0 0 1-1.903 4.597 1.001 1.001 0 0 1-1.415-1.414A4.48 4.48 0 0 0 16.5 12M3 15h2.697a2 2 0 0 1 1.11.336L11 18.13V5.868L6.807 8.664A2 2 0 0 1 5.697 9H3z" />
  </Svg>
);
export default SvgVolumeFullOn;
