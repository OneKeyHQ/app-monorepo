import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.767 7.331a.99.99 0 0 1 0 1.403L7.5 12l3.266 3.266a.992.992 0 0 1-1.403 1.403l-3.441-3.442a1.736 1.736 0 0 1 0-2.454l3.44-3.442a.99.99 0 0 1 1.404 0Zm6.942 0a.99.99 0 0 1 0 1.403L14.443 12l3.266 3.266a.992.992 0 0 1-1.402 1.403l-3.442-3.442a1.736 1.736 0 0 1 0-2.454l3.442-3.442a.99.99 0 0 1 1.402 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleLeft;
