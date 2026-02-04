import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.472 3.118A1 1 0 0 1 13 4v16a1 1 0 0 1-1.555.832L5.697 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.697l5.748-3.832a1 1 0 0 1 1.027-.05M20 9a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2z" />
  </Svg>
);
export default SvgVolumeUp;
