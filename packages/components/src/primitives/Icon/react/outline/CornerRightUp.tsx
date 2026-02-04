import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerRightUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.01 18.99V6.345l-2.304 2.304a1.005 1.005 0 1 1-1.421-1.42l4.019-4.02.076-.068c.395-.322.977-.3 1.345.068l4.019 4.02a1.005 1.005 0 1 1-1.42 1.42l-2.305-2.304V18.99c0 1.11-.9 2.01-2.01 2.01H4.968a1.005 1.005 0 0 1 0-2.01z" />
  </Svg>
);
export default SvgCornerRightUp;
