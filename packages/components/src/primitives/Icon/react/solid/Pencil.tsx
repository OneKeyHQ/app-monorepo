import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPencil = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.879 3.207a3 3 0 0 1 4.242 0l1.672 1.671a3 3 0 0 1 0 4.243L19.414 10.5 13.5 4.586 12.086 6 18 11.914l-9.5 9.5A2 2 0 0 1 7.086 22H3a1 1 0 0 1-1-1v-4.086a2 2 0 0 1 .586-1.414L14.879 3.207Z"
    />
  </Svg>
);
export default SvgPencil;
