import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookmark = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 2.103a2 2 0 0 0-2 2v16.003c0 1.62 1.827 2.568 3.152 1.635L12 18.326l4.848 3.415c1.325.933 3.152-.014 3.152-1.635V4.103a2 2 0 0 0-2-2z" />
  </Svg>
);
export default SvgBookmark;
