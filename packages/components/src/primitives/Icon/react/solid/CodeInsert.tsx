import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeInsert = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 1.5a1 1 0 0 1 1 1V4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3v1.5a1 1 0 1 1-2 0v-19a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M2 6a2 2 0 0 1 2-2h9v16H4a2 2 0 0 1-2-2zm5.707 2.793a1 1 0 0 0-1.414 1.414L8.086 12l-1.793 1.793a1 1 0 1 0 1.414 1.414l2.5-2.5a1 1 0 0 0 0-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCodeInsert;
