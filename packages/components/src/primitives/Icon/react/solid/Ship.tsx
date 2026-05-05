import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.104 13.245-.11.879c-.256 2.052-.714 2.687-1.772 4.456l2.972.661-.433 1.952-5.259-1.169-4.5 1-4.5-1-5.26 1.17-.433-1.953 2.972-.66c-1.058-1.77-1.515-2.405-1.771-4.457l-.11-.879 9.102-2.276zM15 6h4v4.657l-6.999-1.75L5 10.658V6h4V2h6z" />
  </Svg>
);
export default SvgShip;
