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
      d="M19.133 3a2 2 0 0 1 1.98 1.717l.408 2.855a3.85 3.85 0 0 1-.52 2.553V19a2 2 0 0 1-2 2h-5a1 1 0 0 1-1-1v-4h-2v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-8.873a3.85 3.85 0 0 1-.521-2.555l.408-2.855A2 2 0 0 1 4.868 3zm-4.312 7.74A3.78 3.78 0 0 1 12 12a3.78 3.78 0 0 1-2.822-1.259A3.87 3.87 0 0 1 5 11.77V19h4v-3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3h4v-7.231a3.87 3.87 0 0 1-4.18-1.029ZM4.46 7.855a1.88 1.88 0 1 0 3.734.4l.018-.267.003-.051L8.426 5H4.87zm5.751.211v.013a1.794 1.794 0 1 0 3.577 0L13.569 5h-3.137zm5.595.189a1.879 1.879 0 1 0 3.734-.4L19.133 5h-3.56z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStore;
