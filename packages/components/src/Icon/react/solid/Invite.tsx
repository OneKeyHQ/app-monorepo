import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgInvite = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M10 7a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2h-4Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 10.386V5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5.386c1.064-.002 2 .86 2 2.001V18a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-5.613c0-1.142.936-2.003 2-2.001ZM6 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5.946l-5.684 1.895a1 1 0 0 1-.632 0L6 10.946V5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInvite;
