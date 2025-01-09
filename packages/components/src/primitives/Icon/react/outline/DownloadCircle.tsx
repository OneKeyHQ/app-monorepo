import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDownloadCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v5m0 0 2-2m-2 2-2-2m-1 5h6m6-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgDownloadCircle;
