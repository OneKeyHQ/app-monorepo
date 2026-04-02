import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageBlock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 9h8V3h5v8.021A6.5 6.5 0 0 0 12.81 21H3V3h5z" />
    <Path
      fillRule="evenodd"
      d="M14.318 13.318a4.5 4.5 0 1 1 6.364 6.363 4.5 4.5 0 0 1-6.364-6.363m.854 2.268a2.501 2.501 0 0 0 3.242 3.242zm4.096-.854a2.5 2.5 0 0 0-2.682-.56l3.242 3.242a2.5 2.5 0 0 0-.56-2.682"
      clipRule="evenodd"
    />
    <Path d="M14 7h-4V3h4z" />
  </Svg>
);
export default SvgPackageBlock;
