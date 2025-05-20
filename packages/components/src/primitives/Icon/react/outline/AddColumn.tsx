import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddColumn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 19v1a1 1 0 0 0 1-1zm8-9a1 1 0 1 0 2 0zm0 4a1 1 0 1 0-2 0zm-2 6a1 1 0 1 0 2 0zm-2-4a1 1 0 1 0 0 2zm6 2a1 1 0 1 0 0-2zM4 17V7H2v10zm8 1H5v2h7zm8-11v3h2V7zM5 6h7V4H5zm7 0h7V4h-7zm1 13V5h-2v14zm5-5v3h2v-3zm0 3v3h2v-3zm-2 1h3v-2h-3zm3 0h3v-2h-3zm3-11a3 3 0 0 0-3-3v2a1 1 0 0 1 1 1zM4 7a1 1 0 0 1 1-1V4a3 3 0 0 0-3 3zM2 17a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1z"
    />
  </Svg>
);
export default SvgAddColumn;
