import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraExposureSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2m-5.5-5h3a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 13.5 9h-3A1.5 1.5 0 0 0 9 10.5v3a1.5 1.5 0 0 0 1.5 1.5Z"
    />
  </Svg>
);
export default SvgCameraExposureSquare;
