import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraAuto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m12 12.917.265.583h-.53z" />
    <Path
      fillRule="evenodd"
      d="M8.371 3.89A2 2 0 0 1 10.035 3h3.93a2 2 0 0 1 1.664.89L17.035 6H20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.965L8.37 3.89Zm4.54 6.196a1 1 0 0 0-1.821 0l-2.5 5.5a1 1 0 0 0 1.82.828l.416-.914h2.348l.416.914a1 1 0 0 0 1.82-.828z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraAuto;
