import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMixinVirtualMachine = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.258 3.878a.713.713 0 0 1 1.04.138L8 9.261l3.695-5.235a.712.712 0 0 1 .53-.31.712.712 0 0 1 .774.726v7.115a.726.726 0 0 1-.076.336.71.71 0 0 1-.638.392.71.71 0 0 1-.592-.315l-1.6-2.267.873-1.239.605.856V6.68L8.583 10.91a.714.714 0 0 1-1.167 0L4.428 6.68V9.32l.605-.856.874 1.239-1.604 2.272A.713.713 0 0 1 3 11.57V4.428a.71.71 0 0 1 .258-.55Zm5.304 3.657L8 6.738l-.563.797-.874-1.239.853-1.208a.714.714 0 0 1 1.167 0l.853 1.208-.874 1.24Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgMixinVirtualMachine;
