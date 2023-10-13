import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHandPinch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.5 7.75c-.667 1.724-.667 3.275 0 5m13.495-6.71-4.352 2.598-2.01-3.599c-.556-.994-1.785-1.334-2.747-.76-.961.573-1.29 1.844-.736 2.838l3.016 5.397-1.194-.188c-1.098-.172-2.123.607-2.29 1.741L5.5 15.301l5.446 3.55a7.008 7.008 0 0 0 7.449.151c3.447-2.057 4.628-6.612 2.638-10.175l-.92-1.646c-.832-1.49-2.676-2.001-4.118-1.14Z"
    />
  </Svg>
);
export default SvgHandPinch;
