import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraExposureLock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 6a1 1 0 0 1 1-1h2a1 1 0 0 0 0-2H6a3 3 0 0 0-3 3v2a1 1 0 0 0 2 0V6Zm11-3a1 1 0 1 0 0 2h2a1 1 0 0 1 1 1v2a1 1 0 1 0 2 0V6a3 3 0 0 0-3-3h-2ZM5 16a1 1 0 1 0-2 0v2a3 3 0 0 0 3 3h2a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1v-2Zm16 0a1 1 0 1 0-2 0v2a1 1 0 0 1-1 1h-2a1 1 0 1 0 0 2h2a3 3 0 0 0 3-3v-2Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15 10.268V10a3 3 0 1 0-6 0v.268A2 2 0 0 0 8 12v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-1.732ZM11 10h2a1 1 0 1 0-2 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraExposureLock;
