import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPanoramaView = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M23 7.047c0-2.062-2.004-3.428-3.905-2.952-4.826 1.21-9.364 1.21-14.19 0C3.004 3.619 1 4.985 1 7.047v9.904c0 2.069 2.015 3.434 3.917 2.952 4.802-1.215 9.364-1.215 14.166 0 1.902.482 3.917-.883 3.917-2.952V7.047Z"
    />
  </Svg>
);
export default SvgPanoramaView;
