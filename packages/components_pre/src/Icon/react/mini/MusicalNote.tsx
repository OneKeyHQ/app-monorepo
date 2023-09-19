import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMusicalNote = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.721 1.599a.75.75 0 0 1 .279.584v11.29a2.25 2.25 0 0 1-1.774 2.198l-2.041.442a2.216 2.216 0 0 1-.938-4.333l2.662-.576a.75.75 0 0 0 .591-.734V6.112l-8 1.73v7.684a2.25 2.25 0 0 1-1.774 2.2l-2.042.44a2.216 2.216 0 1 1-.935-4.33l2.659-.574A.75.75 0 0 0 7 12.53V4.237a.75.75 0 0 1 .591-.733l9.5-2.054a.75.75 0 0 1 .63.149z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMusicalNote;
