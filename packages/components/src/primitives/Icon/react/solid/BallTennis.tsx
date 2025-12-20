import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallTennis = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 12c0-2.536.944-4.852 2.5-6.615A7.99 7.99 0 0 1 8 12a7.99 7.99 0 0 1-3.5 6.615A9.96 9.96 0 0 1 2 12"
    />
    <Path
      fill="currentColor"
      d="M10 12a9.99 9.99 0 0 0-4-8 9.96 9.96 0 0 1 6-2c2.251 0 4.329.744 6 2a9.99 9.99 0 0 0-4 8 9.99 9.99 0 0 0 4 8 9.96 9.96 0 0 1-6 2 9.96 9.96 0 0 1-6-2 9.99 9.99 0 0 0 4-8"
    />
    <Path
      fill="currentColor"
      d="M19.5 5.385A9.96 9.96 0 0 1 22 12a9.96 9.96 0 0 1-2.5 6.615A7.99 7.99 0 0 1 16 12a7.99 7.99 0 0 1 3.5-6.615"
    />
  </Svg>
);
export default SvgBallTennis;
