import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDice3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm6.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m4 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m2.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDice3;
