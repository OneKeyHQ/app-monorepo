import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudDownload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.598 8.165a7 7 0 0 1 13.343 1.923A5.002 5.002 0 0 1 18 20H7A6 6 0 0 1 5.598 8.165ZM11 9a1 1 0 1 1 2 0v4.086l.793-.793a1 1 0 0 1 1.414 1.414l-2.5 2.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 1 1 1.414-1.414l.793.793V9Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudDownload;
