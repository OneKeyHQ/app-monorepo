import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArchiveBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 2a2 2 0 0 0-2 2v4.008l-.138.009a2 2 0 0 0-.77.201 2 2 0 0 0-.874.874 2 2 0 0 0-.201.77C3 10.07 3 10.316 3 10.568v7.864c0 .252 0 .498.017.706.019.229.063.499.201.77a2 2 0 0 0 .874.874c.271.138.541.182.77.201.208.017.454.017.706.017h12.864c.252 0 .498 0 .706-.017a2 2 0 0 0 .77-.201 2 2 0 0 0 .874-.874 2 2 0 0 0 .201-.77c.017-.208.017-.454.017-.706v-7.864c0-.252 0-.498-.017-.706a2 2 0 0 0-.201-.77 2 2 0 0 0-.874-.874 2 2 0 0 0-.77-.201L19 8.008V6a2 2 0 0 0-2-2h-4.086L11.5 2.586A2 2 0 0 0 10.086 2zm10 6V6h-4.086a2 2 0 0 1-1.414-.586L10.086 4H7v4zM7 13a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArchiveBox;
