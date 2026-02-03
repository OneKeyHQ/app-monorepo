import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageBlock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.318 13.318a4.499 4.499 0 1 1 6.364 6.362 4.499 4.499 0 0 1-6.364-6.362m.855 2.269a2.5 2.5 0 0 0 3.24 3.24zm4.095-.855a2.5 2.5 0 0 0-2.681-.56l3.24 3.24a2.5 2.5 0 0 0-.56-2.68ZM19 10V5h-3v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5H5v14h6a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0m-5-5h-4v3h4z" />
  </Svg>
);
export default SvgPackageBlock;
