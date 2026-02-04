import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeMinimumOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.445 3.168A1 1 0 0 1 13 4v16a1 1 0 0 1-1.555.832L5.697 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.697zM15 12a3 3 0 0 0-.4-1.499 1 1 0 0 1 1.73-1.002c.426.736.67 1.592.67 2.501 0 .91-.244 1.764-.67 2.501a1 1 0 0 1-1.73-1.002c.254-.44.4-.951.4-1.499M3 15h2.697a2 2 0 0 1 1.11.336L11 18.13V5.868L6.807 8.664A2 2 0 0 1 5.697 9H3z" />
  </Svg>
);
export default SvgVolumeMinimumOn;
