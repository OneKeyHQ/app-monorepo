import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewLine = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.186 6.21a.96.96 0 0 1 .15 1.348l-7.017 8.77a1.917 1.917 0 0 1-2.82.191l-5.24-4.99-4.133 4.593A.959.959 0 0 1 1.7 14.839l4.134-4.593a1.917 1.917 0 0 1 2.748-.106l5.24 4.99 7.016-8.77a.96.96 0 0 1 1.348-.15"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTradingViewLine;
