import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolder2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.414 5H22v15H2V3h8.414zM4 18h16v-7H4zm0-9h16V7h-8.414l-2-2H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolder2;
