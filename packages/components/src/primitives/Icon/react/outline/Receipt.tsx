import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgReceipt = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14h4m-3.75-5.05L11.3 10l2.45-2.45M5 5v14.388a.5.5 0 0 0 .748.434l2.287-1.306a1 1 0 0 1 .944-.027l2.574 1.287a1 1 0 0 0 .894 0l2.574-1.287a1 1 0 0 1 .944.026l2.287 1.308a.5.5 0 0 0 .748-.435V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2Z"
    />
  </Svg>
);
export default SvgReceipt;
