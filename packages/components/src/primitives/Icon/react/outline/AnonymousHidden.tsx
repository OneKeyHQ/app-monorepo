import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAnonymousHidden = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 17a2 2 0 1 0-4 0 2 2 0 0 0 4 0M17.133 3a2 2 0 0 1 1.98 1.717L19.866 10H21a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2h1.133l.755-5.283A2 2 0 0 1 6.868 3zm-10.98 7h11.694l-.714-5H6.867zM5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0m16 0a4 4 0 0 1-7.99.273 2 2 0 0 0-2.02.001A4 4 0 0 1 3 17a4 4 0 0 1 7.598-1.747 4 4 0 0 1 2.802-.001A4 4 0 0 1 21 17" />
  </Svg>
);
export default SvgAnonymousHidden;
