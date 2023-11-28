import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCodeInsert = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M16 1.5a1 1 0 0 1 1 1V4h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2v1.5a1 1 0 1 1-2 0v-19a1 1 0 0 1 1-1Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h8v16H5a3 3 0 0 1-3-3V7Zm5.707 1.793a1 1 0 0 0-1.414 1.414L8.086 12l-1.793 1.793a1 1 0 1 0 1.414 1.414l2.5-2.5a1 1 0 0 0 0-1.414l-2.5-2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCodeInsert;
