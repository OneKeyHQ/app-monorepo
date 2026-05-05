import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewLine = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.781 7.625 14.1 18.475l-7.045-6.708-4.312 4.79-1.486-1.337L6.944 8.9l6.955 6.623 7.32-9.148z" />
  </Svg>
);
export default SvgTradingViewLine;
