import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChatAnnotation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22.002 6a3 3 0 0 0-3-3h-14a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h1v2a1 1 0 0 0 1.515.858L12.279 19h6.723a3 3 0 0 0 3-3V6ZM6.25 11a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm4.5 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm5.75 1.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatAnnotation;
