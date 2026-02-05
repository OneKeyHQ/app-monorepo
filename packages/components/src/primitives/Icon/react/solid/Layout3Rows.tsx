import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayout3Rows = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.568 3c-.252 0-.498 0-.706.017a2 2 0 0 0-.77.201 2 2 0 0 0-.874.874 2 2 0 0 0-.201.77C3 5.07 3 5.316 3 5.568V7.67h18v2H3v4.66h18v2H3v2.102c0 .252 0 .498.017.706.019.229.063.499.201.77a2 2 0 0 0 .874.874c.271.138.541.182.77.201.208.017.454.017.706.017h12.864c.252 0 .498 0 .706-.017a2 2 0 0 0 .77-.201 2 2 0 0 0 .874-.874 2 2 0 0 0 .201-.77c.017-.208.017-.454.017-.706V5.568c0-.252 0-.498-.017-.706a2 2 0 0 0-.201-.77 2 2 0 0 0-.874-.874 2 2 0 0 0-.77-.201C18.93 3 18.684 3 18.432 3z" />
  </Svg>
);
export default SvgLayout3Rows;
