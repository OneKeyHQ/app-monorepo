import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.669 18.21a.99.99 0 0 1-1.403 0L12 14.942 8.734 18.21a.992.992 0 0 1-1.403-1.402l3.442-3.442a1.736 1.736 0 0 1 2.454 0l3.442 3.442a.99.99 0 0 1 0 1.402m0-6.943a.99.99 0 0 1-1.403 0L12 8l-3.266 3.266a.992.992 0 0 1-1.403-1.403l3.442-3.441a1.736 1.736 0 0 1 2.454 0l3.442 3.44a.99.99 0 0 1 0 1.404"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleUp;
