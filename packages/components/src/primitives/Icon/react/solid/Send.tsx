import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSend = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2.803 5.572c-.56-1.68 1.18-3.206 2.772-2.43l14.514 7.06c1.5.73 1.5 2.867 0 3.597l-14.514 7.06c-1.592.775-3.332-.75-2.772-2.43L4.613 13H9a1 1 0 1 0 0-2H4.612L2.803 5.572Z"
    />
  </Svg>
);
export default SvgSend;
