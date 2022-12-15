import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgDialogIconTypeDanger = (props: SvgProps) => (
  <Svg viewBox="0 0 48 48" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} width={48} height={48} rx={24} fill="#6B1914" />
    <Path
      d="M24.5 21v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3l-6.928-12c-.77-1.333-2.694-1.333-3.464 0L15.84 28c-.77 1.333.192 3 1.732 3Z"
      stroke="#FF6259"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgDialogIconTypeDanger;
