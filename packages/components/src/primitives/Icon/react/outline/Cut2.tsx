import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCut2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 3a4 4 0 0 1 2.934 6.718l2.066.854V7.86l7.654-3.533.487.404 4.27 3.56-8.963 3.708 8.963 3.709-4.27 3.56-.487.404L11 16.14v-2.713l-2.066.855a4 4 0 1 1-2.269-1.226l2.553-1.057-2.553-1.056A4 4 0 1 1 6 3m0 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7-.14 5.345 2.466 1.243-1.036L13 13.565zm0-5.72v1.295l6.587-2.727-1.242-1.035zM6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCut2;
