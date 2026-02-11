import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookmark = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.849 16.691a2 2 0 0 1 2.302 0L18 20.106V4.103H6v16.003zM20 20.106c0 1.62-1.826 2.568-3.151 1.635L12 18.326l-4.849 3.415c-1.325.933-3.15-.014-3.151-1.635V4.103a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBookmark;
