import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDownload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 14a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3a1 1 0 1 1 2 0v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 15.5a1 1 0 0 0 .707-.293l3.5-3.5a1 1 0 0 0-1.414-1.414L13 12.086V4a1 1 0 1 0-2 0v8.086l-1.793-1.793a1 1 0 1 0-1.414 1.414l3.5 3.5A1 1 0 0 0 12 15.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownload;
