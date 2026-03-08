import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewLine = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.78 7.624 14.1 18.476l-7.044-6.71-4.313 4.792-1.486-1.338L6.944 8.9l6.955 6.624 7.32-9.149 1.561 1.25Z" />
  </Svg>
);
export default SvgTradingViewLine;
