import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraCrossOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.57 3a3 3 0 0 0-2.496 1.336l-.812 1.219A1 1 0 0 1 6.43 6H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-1.43a1 1 0 0 1-.832-.445l-.812-1.22A3 3 0 0 0 13.43 3h-2.86Zm-1.279 7.793a1 1 0 0 1 1.414 0L12 12.088l1.295-1.295a1 1 0 0 1 1.414 1.414l-1.295 1.295 1.293 1.293a1 1 0 0 1-1.414 1.414L12 14.916l-1.293 1.293a1 1 0 0 1-1.414-1.414l1.293-1.293-1.295-1.295a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraCrossOff;
