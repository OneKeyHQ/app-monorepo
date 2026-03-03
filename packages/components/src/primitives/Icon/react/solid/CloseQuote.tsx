import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloseQuote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 4v9c0 2.585-1.162 4.335-2.316 5.417a8.2 8.2 0 0 1-1.569 1.15c-.671.378-1.394.606-2.115.876V14H2V4zm11.005 0v9c0 2.585-1.162 4.335-2.316 5.417a8.2 8.2 0 0 1-1.569 1.15c-.671.378-1.394.605-2.115.875L16 14h-3l.005-10z" />
  </Svg>
);
export default SvgCloseQuote;
