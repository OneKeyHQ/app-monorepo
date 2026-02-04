import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraGopro = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.535 3.5a4 4 0 0 0-.535 2v5a4 4 0 0 0 4 4h5c.729 0 1.412-.195 2-.535V18.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2zM6 15.5a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M20 3.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zm-2.5 3.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraGopro;
