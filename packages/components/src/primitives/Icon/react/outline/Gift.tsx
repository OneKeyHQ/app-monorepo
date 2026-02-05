import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGift = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 13h-5v6h5zm-7 6v-6H6v6zm2-10v2h6V9zm-8 2h6V9H5zm11-6.333A.667.667 0 0 0 15.333 4 2.333 2.333 0 0 0 13 6.333V7h.667A2.333 2.333 0 0 0 16 4.667m-8 0A2.333 2.333 0 0 0 10.333 7H11v-.667A2.333 2.333 0 0 0 8.667 4 .667.667 0 0 0 8 4.667m10 0c0 .86-.251 1.66-.683 2.333H19a2 2 0 0 1 2 2v2c0 .74-.403 1.383-1 1.73V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6.27c-.597-.347-1-.99-1-1.73V9a2 2 0 0 1 2-2h1.683A4.3 4.3 0 0 1 6 4.667 2.667 2.667 0 0 1 8.667 2c1.34 0 2.538.609 3.333 1.564A4.32 4.32 0 0 1 15.333 2 2.667 2.667 0 0 1 18 4.667" />
  </Svg>
);
export default SvgGift;
