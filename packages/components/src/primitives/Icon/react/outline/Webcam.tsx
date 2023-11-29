import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWebcam = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M7 21h10m-5-4a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0 0v4m3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgWebcam;
