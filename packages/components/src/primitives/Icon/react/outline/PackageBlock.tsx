import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageBlock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 10h-2V5h-3v5H8V5H5v14h6v2H3V3h18zM10 8h4V5h-4z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M14.318 13.318a4.5 4.5 0 1 1 6.364 6.363 4.5 4.5 0 0 1-6.364-6.363m.855 2.269a2.5 2.5 0 0 0 3.24 3.24zm4.095-.855a2.5 2.5 0 0 0-2.681-.56l3.24 3.24a2.5 2.5 0 0 0-.56-2.68Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageBlock;
