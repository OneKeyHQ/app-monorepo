import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotebook1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 21.5h-.5a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2H6z" />
    <Path
      fillRule="evenodd"
      d="M18.5 2.5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8v-19zM13 11a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2zm0-4a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook1;
