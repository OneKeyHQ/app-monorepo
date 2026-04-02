import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotebook1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.5 13H12v-2h4.5zm0-4H12V7h4.5z" />
    <Path
      fillRule="evenodd"
      d="M20.5 21.5h-17v-19h17zm-15-2H8v-15H5.5zm4.5 0h8.5v-15H10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook1;
