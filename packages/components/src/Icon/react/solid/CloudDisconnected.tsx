import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudDisconnected = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 12a8 8 0 0 1 14.883-4.079c.046.077.169.152.315.132A6 6 0 0 1 19.4 19.5a1 1 0 0 1-.8-1.832 4.001 4.001 0 0 0-2.137-7.632c-.881.117-1.815-.278-2.3-1.094a6 6 0 1 0-8.592 7.983 1 1 0 0 1-1.143 1.64A7.992 7.992 0 0 1 1 12Zm8.293 3.293a1 1 0 0 1 1.414 0L12 16.586l1.293-1.293a1 1 0 0 1 1.414 1.414L13.414 18l1.293 1.293a1 1 0 0 1-1.414 1.414L12 19.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L10.586 18l-1.293-1.293a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudDisconnected;
