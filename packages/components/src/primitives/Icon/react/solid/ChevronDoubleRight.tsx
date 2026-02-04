import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6.29 7.331a.99.99 0 0 1 1.403 0l3.441 3.442a1.736 1.736 0 0 1 0 2.454l-3.44 3.442a.992.992 0 0 1-1.404-1.403L9.557 12 6.29 8.734a.99.99 0 0 1 0-1.403m6.943 0a.99.99 0 0 1 1.403 0l3.441 3.442a1.736 1.736 0 0 1 0 2.454l-3.44 3.442a.992.992 0 0 1-1.404-1.403L16.5 12l-3.266-3.266a.99.99 0 0 1 0-1.403Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleRight;
