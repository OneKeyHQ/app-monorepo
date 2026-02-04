import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.862 3.017C5.07 3 5.316 3 5.568 3H13v18h2V3h3.432c.252 0 .498 0 .706.017.229.019.499.063.77.201a2 2 0 0 1 .874.874c.138.271.182.541.201.77.017.208.017.454.017.706v12.864c0 .252 0 .498-.017.706a2 2 0 0 1-.201.77 2 2 0 0 1-.874.874 2 2 0 0 1-.77.201c-.208.017-.454.017-.706.017H5.568c-.252 0-.498 0-.706-.017a2 2 0 0 1-.77-.201 2 2 0 0 1-.874-.874 2 2 0 0 1-.201-.77C3 18.93 3 18.684 3 18.432V5.568c0-.252 0-.498.017-.706a2 2 0 0 1 .201-.77 2 2 0 0 1 .874-.874 2 2 0 0 1 .77-.201" />
  </Svg>
);
export default SvgLayoutRight;
