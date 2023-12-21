import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDownloadCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm7 5a1 1 0 1 1 0-2h6a1 1 0 1 1 0 2H9Zm5.707-5.293-2 2a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414l.293.293V8a1 1 0 1 1 2 0v2.586l.293-.293a1 1 0 1 1 1.414 1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownloadCircle;
