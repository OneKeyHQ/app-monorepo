import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 20h2v-2h-2zm7-7h2v-2h-2zM4 13h2v-2H4zm7-7h2V4h-2zm-3 7.5-.008.153a1.5 1.5 0 0 1-1.206 1.319 6.03 6.03 0 0 0 2.241 2.24A1.5 1.5 0 0 1 10.5 16h3a1.5 1.5 0 0 1 1.472 1.213 6.03 6.03 0 0 0 2.24-2.241A1.5 1.5 0 0 1 16 13.5v-3a1.5 1.5 0 0 1 1.213-1.473 6.03 6.03 0 0 0-2.241-2.24A1.5 1.5 0 0 1 13.5 8h-3a1.5 1.5 0 0 1-1.473-1.214 6.04 6.04 0 0 0-2.24 2.241A1.5 1.5 0 0 1 8 10.5zm7-8.916A8.02 8.02 0 0 1 19.416 9H20.5a1.5 1.5 0 0 1 1.5 1.5v3l-.008.153A1.5 1.5 0 0 1 20.5 15h-1.084A8.02 8.02 0 0 1 15 19.415V20.5l-.008.153A1.5 1.5 0 0 1 13.5 22h-3A1.5 1.5 0 0 1 9 20.5v-1.085A8.02 8.02 0 0 1 4.584 15H3.5A1.5 1.5 0 0 1 2 13.5v-3A1.5 1.5 0 0 1 3.5 9h1.084A8.02 8.02 0 0 1 9 4.584V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5z" />
  </Svg>
);
export default SvgBezierCircle;
