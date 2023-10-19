import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTextIndentLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M2 14.22V9.78c0-.836.914-1.322 1.572-.837l3.01 2.22c.557.41.557 1.264 0 1.674l-3.01 2.22C2.914 15.543 2 15.056 2 14.22Z"
    />
  </Svg>
);
export default SvgTextIndentLeft;
