import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloseQuote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.004 4c1.103 0 1.999.893 1.999 1.999v7c0 2.586-1.161 4.336-2.316 5.418-.57.535-1.14.91-1.568 1.15a7 7 0 0 1-.738.359l-.017.007-.005.001-.003.001-.002.001a1 1 0 0 1-1.35-.935L5 14H4a2 2 0 0 1-2-2.001l.003-6a2 2 0 0 1 2-2zM20 4a2 2 0 0 1 2 1.999v7c0 2.586-1.162 4.336-2.316 5.418a8.2 8.2 0 0 1-1.569 1.15 7 7 0 0 1-.688.34l-.05.019-.016.007-.006.001-.003.002A1 1 0 0 1 16 19v-5h-1a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
  </Svg>
);
export default SvgCloseQuote;
