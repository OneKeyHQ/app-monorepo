import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotebook3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 11a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm2-4a1 1 0 1 1 0 2h-4a1 1 0 0 1 0-2z" />
    <Path
      fillRule="evenodd"
      d="M18.5 2.5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V17a1 1 0 1 1 0-2v-2a1 1 0 1 1 0-2V9a1 1 0 0 1 0-2V4.5a2 2 0 0 1 2-2zM5.5 7a1 1 0 0 1 0 2v2a1 1 0 1 1 0 2v2a1 1 0 1 1 0 2v2.5h13v-15h-13z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook3;
