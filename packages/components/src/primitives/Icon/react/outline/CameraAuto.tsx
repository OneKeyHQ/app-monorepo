import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraAuto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.035 8a2 2 0 0 1-1.664-.89L13.965 5h-3.93L8.63 7.11A2 2 0 0 1 6.965 8H4v11h16V8zM12 9.5a1 1 0 0 1 .91.586l2.5 5.5a1 1 0 0 1-1.82.828l-.415-.914h-2.35l-.415.914a1 1 0 0 1-1.82-.828l2.5-5.5.07-.127A1 1 0 0 1 12 9.5m-.266 4h.532L12 12.916zM22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.965L8.37 3.89A2 2 0 0 1 10.035 3h3.93a2 2 0 0 1 1.664.89L17.035 6H20a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCameraAuto;
