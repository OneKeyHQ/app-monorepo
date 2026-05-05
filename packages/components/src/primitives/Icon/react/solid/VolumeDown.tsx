import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 20.928 5.746 17H1V7h4.746L13 3.07v17.857ZM23 11v2h-8v-2z" />
  </Svg>
);
export default SvgVolumeDown;
