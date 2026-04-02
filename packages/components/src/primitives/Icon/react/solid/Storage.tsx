import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStorage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 19h-2v-2h2zm3 0h-2v-2h2z" />
    <Path
      fillRule="evenodd"
      d="M20 2v20H4V2zM6 16v4h12v-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStorage;
