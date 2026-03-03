import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGift = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.333 2A2.667 2.667 0 0 1 18 4.667c0 .86-.251 1.66-.683 2.333H21v6h-1v8H4v-8H3V7h3.683A4.3 4.3 0 0 1 6 4.667 2.667 2.667 0 0 1 8.667 2c1.34 0 2.538.609 3.333 1.564A4.32 4.32 0 0 1 15.333 2M6 19h5v-6H6zm7 0h5v-6h-5zm-8-8h6V9H5zm8 0h6V9h-6zM8.667 4A.667.667 0 0 0 8 4.667 2.333 2.333 0 0 0 10.333 7H11v-.667A2.333 2.333 0 0 0 8.667 4m6.666 0A2.333 2.333 0 0 0 13 6.333V7h.667A2.333 2.333 0 0 0 16 4.667.667.667 0 0 0 15.333 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGift;
