import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowPathLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8.54 4.415c.977-.814 2.46-.12 2.46 1.153V8h8a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-8v2.433c0 1.271-1.483 1.966-2.46 1.152L1.743 13.92a2.5 2.5 0 0 1 0-3.841L8.54 4.414Z"
    />
  </Svg>
);
export default SvgArrowPathLeft;
