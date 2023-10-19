import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.707 2.293a1 1 0 0 0-1.414 1.414L4.61 6.025A3 3 0 0 0 2 9v9a3 3 0 0 0 3 3h14c.184 0 .363-.017.538-.048l.755.755a1 1 0 0 0 1.414-1.414l-18-18ZM13.975 15.39 9.11 10.525a3.5 3.5 0 0 0 4.865 4.865Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M8.291 4.05 22 17.757V9a3 3 0 0 0-3-3h-1.43a1 1 0 0 1-.832-.445l-.812-1.22A3 3 0 0 0 13.43 3h-2.86a3 3 0 0 0-2.279 1.05Z"
    />
  </Svg>
);
export default SvgCameraOff;
