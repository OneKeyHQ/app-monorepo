import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerSquareLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.336a2 2 0 0 1-.586 1.414l-2.177 2.177a1.75 1.75 0 0 1-2.474 0L8.586 7.75A2 2 0 0 1 8 6.336V4Zm12 4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2.336a2 2 0 0 1-1.414-.586l-2.177-2.177a1.75 1.75 0 0 1 0-2.474l2.177-2.177A2 2 0 0 1 17.664 8H20Zm-4 9.664V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.336a2 2 0 0 1 .586-1.414l2.177-2.177a1.75 1.75 0 0 1 2.474 0l2.177 2.177A2 2 0 0 1 16 17.664Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 14a2 2 0 0 0 2 2h2.336a2 2 0 0 0 1.414-.586l2.177-2.177a1.75 1.75 0 0 0 0-2.474L7.75 8.586A2 2 0 0 0 6.336 8H4a2 2 0 0 0-2 2v4Zm2 0v-4h2.336l2 2-2 2H4Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControllerSquareLeft;
