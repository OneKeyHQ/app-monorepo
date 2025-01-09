import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentGraph1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h5.101A7 7 0 0 1 20 10.674V5a3 3 0 0 0-3-3H7Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17 12a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-3 5c0-1.306.835-2.418 2-2.83V17a1 1 0 0 0 .293.707l2 2A3 3 0 0 1 14 17Zm4-.414V14.17a3.001 3.001 0 0 1 1.708 4.123L18 16.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentGraph1;
