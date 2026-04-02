import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTree = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a9 9 0 0 1 1 17.945V22h-2v-2.055A9.002 9.002 0 0 1 12 2m0 11.586-2-2L8.586 13 11 15.414v2.515a7 7 0 0 0 2 0v-2.515L16.414 12 15 10.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTree;
