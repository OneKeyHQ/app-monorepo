import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraExposureFlash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2M12 8l-3 4h6l-3 4"
    />
  </Svg>
);
export default SvgCameraExposureFlash;
