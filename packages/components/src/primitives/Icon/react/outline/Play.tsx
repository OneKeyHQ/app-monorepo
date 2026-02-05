import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlay = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.104 4.074c0-1.553 1.7-2.507 3.025-1.7l13.007 7.927c1.272.775 1.272 2.623 0 3.398L8.129 21.625c-1.284.783-2.919-.088-3.02-1.555l-.005-.144zm1.99 15.852L20.1 12 7.094 4.074z" />
  </Svg>
);
export default SvgPlay;
