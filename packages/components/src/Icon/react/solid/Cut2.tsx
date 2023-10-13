import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCut2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM2 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-4 2a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M20.11 5.541a3 3 0 0 0-3.177-.42l-4.19 1.935a3 3 0 0 0-1.744 2.724v.793L7.382 9.076l-.765 1.848L9.217 12l-2.6 1.076.765 1.848 3.617-1.497v.793a3 3 0 0 0 1.743 2.724l4.19 1.934a3 3 0 0 0 3.179-.419l2.029-1.69a1 1 0 0 0-.258-1.693L14.448 12l7.434-3.076a1 1 0 0 0 .258-1.692l-2.03-1.69Z"
    />
  </Svg>
);
export default SvgCut2;
