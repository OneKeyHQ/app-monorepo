import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwapVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.586 3.769c.78-.781 1.633-1.1 2.414-.319v16.82a1 1 0 0 1-2 0V6.183L5.707 8.476a1 1 0 1 1-1.414-1.414zM15 3a1 1 0 0 1 1 1v14.086l2.293-2.293a1 1 0 1 1 1.414 1.414L16.414 20.5c-.781.781-1.633 1.1-2.414.318V4a1 1 0 0 1 1-1" />
  </Svg>
);
export default SvgSwapVer;
