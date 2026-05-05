import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStore = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m20.867 3 .654 4.572a3.85 3.85 0 0 1-.52 2.554V21h-8v-5h-2v5H3V10.126a3.85 3.85 0 0 1-.521-2.554L3.133 3zm-6.046 7.74A3.78 3.78 0 0 1 12 12a3.78 3.78 0 0 1-2.822-1.259A3.87 3.87 0 0 1 5 11.77V19h4v-5h6v5h4v-7.231a3.87 3.87 0 0 1-4.18-1.028ZM4.46 7.855a1.88 1.88 0 1 0 3.734.4l.018-.267.003-.051L8.426 5H4.867zm5.751.211v.013a1.794 1.794 0 1 0 3.576 0L13.568 5h-3.136zm5.595.189a1.879 1.879 0 1 0 3.734-.4L19.133 5h-3.56z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStore;
