import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgError = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.318 3.18c.755-1.281 2.61-1.281 3.364 0l8.047 13.662c.766 1.302-.174 2.939-1.681 2.939H3.952c-1.507 0-2.447-1.637-1.68-2.939zM3.954 17.83h16.092L12 4.17zm8.049-4.147a1.22 1.22 0 1 1 0 2.44 1.22 1.22 0 0 1 0-2.44m-.979-1.696V10.04a.976.976 0 1 1 1.952 0v1.947a.976.976 0 0 1-1.952 0" />
  </Svg>
);
export default SvgError;
