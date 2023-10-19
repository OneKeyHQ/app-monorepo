import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNumberedList = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.526 3.65A1 1 0 0 1 7 4.5v5a1 1 0 1 1-2 0V6.118l-.553.276a1 1 0 1 1-.894-1.788l2-1a1 1 0 0 1 .973.043ZM12 6a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2h-8Zm0 10a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2h-8Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M4.86 15.793h-.002v.002l-.003.001v.001a1 1 0 0 1-1.214-1.59l.058-.043.119-.08a4.11 4.11 0 0 1 .4-.23c.319-.157.82-.354 1.393-.354a2.39 2.39 0 0 1 2.39 2.389c0 .765-.332 1.353-.734 1.79-.306.332-.677.603-1.002.821h.985a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1c0-.754.392-1.299.779-1.668.327-.312.742-.581 1.068-.793l.106-.07c.385-.25.657-.443.843-.645.16-.175.204-.3.204-.435a.389.389 0 0 0-.389-.389c-.137 0-.317.053-.502.145a2.035 2.035 0 0 0-.25.148Z"
    />
  </Svg>
);
export default SvgNumberedList;
