import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHead = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 2a8 8 0 0 0-6.298 12.934c1.199 1.528 1.302 3.008 1.3 5.065A2 2 0 0 0 8 22h5a2 2 0 0 0 2-2 1 1 0 0 1 1-1 3 3 0 0 0 3-3v-1.934l1.115-.669a1.982 1.982 0 0 0 .612-2.835l-.216-.309c-.832-1.187-1.495-2.131-2.024-3.485C17.222 3.535 14.162 2 11 2Z"
    />
  </Svg>
);
export default SvgHead;
