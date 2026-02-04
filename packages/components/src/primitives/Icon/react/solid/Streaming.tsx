import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStreaming = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm-8 11c-2.213 0-3.61 1.089-4.19 2.061-.283.475.138.939.69.939h7c.552 0 .973-.464.69-.939C15.61 16.09 14.213 15 12 15m0-6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M17.75 7a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5" />
  </Svg>
);
export default SvgStreaming;
