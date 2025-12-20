import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgContrast = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 4a8 8 0 1 0 0 16zM2 12C2 6.477 6.477 2 12 2q.563 0 1.11.061C18.11 2.614 22 6.852 22 12s-3.89 9.386-8.89 9.939q-.547.06-1.11.061C6.477 22 2 17.523 2 12"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgContrast;
