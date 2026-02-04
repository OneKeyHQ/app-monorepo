import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKey2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 8.5a6.5 6.5 0 0 1-8.64 6.14l-1.774 1.774a2 2 0 0 1-1.414.586H9.5a.5.5 0 0 0-.5.5v.672a2 2 0 0 1-.586 1.414l-.828.828A2 2 0 0 1 6.172 21H4a1 1 0 0 1-1-1v-2.172a2 2 0 0 1 .586-1.414L9.36 10.64A6.5 6.5 0 1 1 22 8.5m-5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKey2;
