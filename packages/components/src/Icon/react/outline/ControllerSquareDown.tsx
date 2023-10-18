import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerSquareDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 21h4a1 1 0 0 0 1-1v-2.336a1 1 0 0 0-.293-.707L12.53 14.78a.75.75 0 0 0-1.06 0l-2.177 2.177a1 1 0 0 0-.293.707V20a1 1 0 0 0 1 1Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 3h-4a1 1 0 0 0-1 1v2.336a1 1 0 0 0 .293.707L11.47 9.22a.75.75 0 0 0 1.06 0l2.177-2.177A1 1 0 0 0 15 6.336V4a1 1 0 0 0-1-1Zm7 11v-4a1 1 0 0 0-1-1h-2.336a1 1 0 0 0-.707.293L14.78 11.47a.75.75 0 0 0 0 1.06l2.177 2.177a1 1 0 0 0 .707.293H20a1 1 0 0 0 1-1ZM3 10v4a1 1 0 0 0 1 1h2.336a1 1 0 0 0 .707-.293L9.22 12.53a.75.75 0 0 0 0-1.06L7.043 9.293A1 1 0 0 0 6.336 9H4a1 1 0 0 0-1 1Z"
    />
  </Svg>
);
export default SvgControllerSquareDown;
