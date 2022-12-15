import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgDialogIconTypeInfo = (props: SvgProps) => (
  <Svg viewBox="0 0 48 48" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} width={48} height={48} rx={24} fill="#3D3D4D" />
    <Path
      d="M25.5 28h-1v-4h-1m1-4h.01m8.99 4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      stroke="#8C8CA1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgDialogIconTypeInfo;
