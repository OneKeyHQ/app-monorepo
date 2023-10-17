import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraExposureFlower = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2m-4-6v2m0-2a3 3 0 0 1-3-3V8.75l1.75.75L12 8.25l1.25 1.25L15 8.75V11a3 3 0 0 1-3 3Z"
    />
  </Svg>
);
export default SvgCameraExposureFlower;
