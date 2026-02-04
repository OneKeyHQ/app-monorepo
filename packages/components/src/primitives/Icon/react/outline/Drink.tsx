import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDrink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.284 1.024a1.001 1.001 0 0 1 .433 1.953L13 3.802V6h3.931a2 2 0 0 1 1.995 2.133l-.866 13A2 2 0 0 1 16.065 23h-8.13a2 2 0 0 1-1.995-1.867l-.866-13A2 2 0 0 1 7.069 6H11V3a1 1 0 0 1 .784-.976zM7.936 21h8.129l.533-8H7.403zm-.667-10h9.462l.2-3H7.069z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDrink;
