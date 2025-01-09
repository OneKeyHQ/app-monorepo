import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFigma = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.665 2a3.335 3.335 0 0 0-.014 6.667 3.335 3.335 0 0 0 .014 6.666H12V12.02a3.335 3.335 0 1 0 3.347-3.354A3.335 3.335 0 0 0 15.332 2H8.665Zm6.647 6.667h-3.313v3.312a3.335 3.335 0 0 1 3.313-3.312Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M8.665 22A3.334 3.334 0 0 0 12 18.667v-3.334H8.665a3.335 3.335 0 0 0 0 6.667Z"
    />
  </Svg>
);
export default SvgFigma;
