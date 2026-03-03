import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotebook1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 21.5H3.5v-19H7z" />
    <Path
      fillRule="evenodd"
      d="M20.5 2.5v19H9v-19zm-8 10.5H17v-2h-4.5zm0-4H17V7h-4.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook1;
