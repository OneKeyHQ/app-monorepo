import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraExposureSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 5a1 1 0 0 0-1 1v2a1 1 0 0 1-2 0V6a3 3 0 0 1 3-3h2a1 1 0 0 1 0 2H6Zm9-1a1 1 0 0 1 1-1h2a3 3 0 0 1 3 3v2a1 1 0 1 1-2 0V6a1 1 0 0 0-1-1h-2a1 1 0 0 1-1-1ZM4 15a1 1 0 0 1 1 1v2a1 1 0 0 0 1 1h2a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3v-2a1 1 0 0 1 1-1Zm16 0a1 1 0 0 1 1 1v2a3 3 0 0 1-3 3h-2a1 1 0 1 1 0-2h2a1 1 0 0 0 1-1v-2a1 1 0 0 1 1-1Zm-9.5-7A2.5 2.5 0 0 0 8 10.5v3a2.5 2.5 0 0 0 2.5 2.5h3a2.5 2.5 0 0 0 2.5-2.5v-3A2.5 2.5 0 0 0 13.5 8h-3Z"
    />
  </Svg>
);
export default SvgCameraExposureSquare;
