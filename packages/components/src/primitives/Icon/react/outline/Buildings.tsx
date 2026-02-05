import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBuildings = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 9v9h4V9zm-5 3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2zm0-4a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2zM5 5v13h8V5zm10 2h4a2 2 0 0 1 2 2v9h1a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2h1V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBuildings;
