import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 20.928 5.746 17H1V7h4.746L13 3.07v17.857ZM20 8v3h3v2h-3v3h-2v-3h-3v-2h3V8z" />
  </Svg>
);
export default SvgVolumeUp;
