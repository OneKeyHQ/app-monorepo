import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColumnWide = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 17V7H2v10zm8 1H5v2h7zm8-11v10h2V7zM5 6h7V4H5zm7 0h7V4h-7zm1 13V5h-2v14zm6-1h-7v2h7zm1-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zm2-10a3 3 0 0 0-3-3v2a1 1 0 0 1 1 1zM4 7a1 1 0 0 1 1-1V4a3 3 0 0 0-3 3zM2 17a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1z"
    />
  </Svg>
);
export default SvgColumnWide;
