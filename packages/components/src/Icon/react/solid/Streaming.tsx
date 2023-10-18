import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStreaming = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm15.75 2.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM14.5 11a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-6.69 6.061C8.39 16.09 9.786 15 12 15s3.61 1.089 4.19 2.061c.284.475-.138.939-.69.939h-7c-.552 0-.974-.464-.69-.939Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStreaming;
