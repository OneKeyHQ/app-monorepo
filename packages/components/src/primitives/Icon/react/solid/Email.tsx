import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.004 6.114C2 6.258 2 6.412 2 6.568v10.864c0 .252 0 .498.017.706.019.229.063.499.201.77a2 2 0 0 0 .874.874c.271.138.541.182.77.201.208.017.454.017.706.017h14.864c.252 0 .498 0 .706-.017a2 2 0 0 0 .77-.201 2 2 0 0 0 .874-.874 2 2 0 0 0 .201-.77c.017-.208.017-.454.017-.706V6.568c0-.156 0-.31-.004-.454l-8.73 7.142a2 2 0 0 1-2.533 0L2.005 6.114Z" />
    <Path d="M21.054 4.3a2 2 0 0 0-.146-.082 2 2 0 0 0-.77-.201C19.93 4 19.684 4 19.432 4H4.568c-.252 0-.498 0-.706.017a2 2 0 0 0-.77.201q-.075.038-.146.082L12 11.708z" />
  </Svg>
);
export default SvgEmail;
