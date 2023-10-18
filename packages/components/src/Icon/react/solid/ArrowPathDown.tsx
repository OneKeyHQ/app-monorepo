import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowPathDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4.415 15.46c-.814-.977-.12-2.46 1.153-2.46H8V5a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v8h2.433c1.271 0 1.966 1.483 1.152 2.46l-5.664 6.797a2.5 2.5 0 0 1-3.841 0L4.414 15.46Z"
    />
  </Svg>
);
export default SvgArrowPathDown;
