import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwapVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.586 3.769c.78-.781 1.633-1.1 2.414-.319v16.82a1 1 0 0 1-2 0V6.183L5.707 8.476a1 1 0 0 1-1.414-1.414zM16.414 20.5c-.78.781-1.633 1.1-2.414.318V4a1 1 0 1 1 2 0v14.086l2.293-2.293a1 1 0 0 1 1.414 1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwapVer;
