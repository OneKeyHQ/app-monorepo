import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgResizeBig = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.568 3h12.864c.252 0 .498 0 .706.017.229.019.499.063.77.201a2 2 0 0 1 .874.874c.138.271.182.541.201.77.017.208.017.454.017.706V13a1 1 0 1 1-2 0V5.6c0-.297 0-.459-.01-.575l-.001-.014A8 8 0 0 0 18.4 5H5.6a8 8 0 0 0-.589.011v.014C5 5.14 5 5.303 5 5.6v12.8a8 8 0 0 0 .011.589h.014c.116.01.278.011.575.011H13a1 1 0 1 1 0 2H5.568c-.252 0-.498 0-.706-.017a2 2 0 0 1-.77-.201 2 2 0 0 1-.874-.874 2 2 0 0 1-.201-.77C3 18.93 3 18.684 3 18.432V5.568c0-.252 0-.498.017-.706a2 2 0 0 1 .201-.77m0 0a2 2 0 0 1 .874-.874 2 2 0 0 1 .77-.201C5.07 3 5.316 3 5.568 3m3.725 6.293A1 1 0 0 1 10 9h5a1 1 0 1 1 0 2h-2.586l6.293 6.293a1 1 0 0 1-1.414 1.414L11 12.414V15a1 1 0 1 1-2 0v-5a1 1 0 0 1 .293-.707"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgResizeBig;
