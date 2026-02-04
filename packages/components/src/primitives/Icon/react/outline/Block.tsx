import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a7.96 7.96 0 0 0-1.682-4.905L7.095 18.318A8 8 0 0 0 20 12M4 12a7.96 7.96 0 0 0 1.68 4.904L16.905 5.681A8 8 0 0 0 4 12m18 0c0 5.523-4.477 10-10 10a9.97 9.97 0 0 1-7.071-2.929A9.97 9.97 0 0 1 2 12C2 6.477 6.477 2 12 2a9.97 9.97 0 0 1 7.071 2.929A9.97 9.97 0 0 1 22 12" />
  </Svg>
);
export default SvgBlock;
