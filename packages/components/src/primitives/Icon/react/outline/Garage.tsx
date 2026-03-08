import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGarage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m21.485 8.126.515.285V20H2V8.411l.515-.285L12 2.856zM4 9.588V18h2v-8h12v8h2V9.588l-8-4.444zM8 16v2h8v-2zm0-2h8v-2H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGarage;
