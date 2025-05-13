import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRemoveColumn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 19v1a1 1 0 0 0 1-1zm8-9a1 1 0 1 0 2 0zm-2.293 4.293a1 1 0 0 0-1.414 1.414zm2.586 5.414a1 1 0 0 0 1.414-1.414zm-4-1.414a1 1 0 0 0 1.414 1.414zm5.414-2.586a1 1 0 0 0-1.414-1.414zM4 17V7H2v10zm8 1H5v2h7zm8-11v3h2V7zM5 6h7V4H5zm7 0h7V4h-7zm1 13V5h-2v14zm3.293-3.293 2 2 1.414-1.414-2-2zm2 2 2 2 1.414-1.414-2-2zm-.586 2 2-2-1.414-1.414-2 2zm2-2 2-2-1.414-1.414-2 2zM22 7a3 3 0 0 0-3-3v2a1 1 0 0 1 1 1zM4 7a1 1 0 0 1 1-1V4a3 3 0 0 0-3 3zM2 17a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1z"
    />
  </Svg>
);
export default SvgRemoveColumn;
