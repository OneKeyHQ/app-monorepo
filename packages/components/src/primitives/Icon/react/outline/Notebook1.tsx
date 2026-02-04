import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotebook1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.5 11a1 1 0 1 1 0 2H13a1 1 0 1 1 0-2zm0-4a1 1 0 1 1 0 2H13a1 1 0 1 1 0-2z" />
    <Path
      fillRule="evenodd"
      d="M18.5 2.5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zm-13 17H8v-15H5.5zm4.5 0h8.5v-15H10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook1;
