import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageRemove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.035 15.379-2.12 2.121 2.12 2.121-1.414 1.414-2.121-2.12-2.121 2.12-1.414-1.414 2.12-2.121-2.12-2.121 1.414-1.414 2.121 2.12 2.121-2.12z" />
    <Path
      fillRule="evenodd"
      d="M21 3v9h-2V5h-3v5H8V5H5v14h8v2H3V3zM10 8h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageRemove;
