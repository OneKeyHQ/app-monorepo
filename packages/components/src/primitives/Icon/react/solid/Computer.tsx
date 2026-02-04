import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgComputer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 3a2 2 0 0 0-2 2v7h20V5a2 2 0 0 0-2-2z" />
    <Path
      fillRule="evenodd"
      d="M2 16v-2h20v2a2 2 0 0 1-2 2h-5v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3H4a2 2 0 0 1-2-2m9 2v2h2v-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgComputer;
