import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileGraph = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 2h6v6a2 2 0 0 0 2 2h6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m3.5 14.5a1 1 0 1 0-2 0V18a1 1 0 1 0 2 0zm2.5-4a1 1 0 0 1 1 1V18a1 1 0 1 1-2 0v-4.5a1 1 0 0 1 1-1m4.5 3a1 1 0 1 0-2 0V18a1 1 0 1 0 2 0z"
      clipRule="evenodd"
    />
    <Path d="M14 2.586 19.414 8H14z" />
  </Svg>
);
export default SvgFileGraph;
