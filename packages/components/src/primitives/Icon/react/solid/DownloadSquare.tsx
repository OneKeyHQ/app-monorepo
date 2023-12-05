import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDownloadSquare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm6 11a1 1 0 1 1 0-2h6a1 1 0 1 1 0 2H9Zm5.707-5.293-2 2a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414l.293.293V8a1 1 0 1 1 2 0v2.586l.293-.293a1 1 0 1 1 1.414 1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownloadSquare;
