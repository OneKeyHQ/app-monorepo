import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.445 3.168A1 1 0 0 1 13 4v16a1 1 0 0 1-1.555.832L5.697 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.697zm9.348 6.125a1 1 0 1 1 1.414 1.414l-1.414 1.414 1.414 1.414a1 1 0 0 1-1.414 1.415l-1.414-1.415-1.414 1.415a1.001 1.001 0 0 1-1.415-1.415l1.414-1.414-1.414-1.414a1 1 0 0 1 1.415-1.414l1.414 1.414zM3 15h2.697a2 2 0 0 1 1.11.336L11 18.13V5.868L6.807 8.664A2 2 0 0 1 5.697 9H3z" />
  </Svg>
);
export default SvgVolumeOff;
