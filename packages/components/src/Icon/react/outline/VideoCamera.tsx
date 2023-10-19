import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoCamera = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm12.553 2.724 4-2A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894l-4-2a1 1 0 0 1-.553-.894v-2.764a1 1 0 0 1 .553-.894Z"
    />
  </Svg>
);
export default SvgVideoCamera;
