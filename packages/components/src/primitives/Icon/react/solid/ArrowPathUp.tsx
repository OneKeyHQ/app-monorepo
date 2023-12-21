import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowPathUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4.415 8.54c-.814.977-.12 2.46 1.153 2.46H8v8a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3v-8h2.433c1.271 0 1.966-1.483 1.152-2.46L13.92 1.743a2.5 2.5 0 0 0-3.841 0L4.414 8.54Z"
    />
  </Svg>
);
export default SvgArrowPathUp;
