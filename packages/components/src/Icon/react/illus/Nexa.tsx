import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgNexa = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path d="m7.979 10.776 6.02-6.497-6.02 9.905v-3.408Z" fill="#8C8CA1" />
    <Path d="M7.982 10.776 2 4.28l5.982 9.905v-3.408Z" fill="#8C8CA1" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 4.279h12l-6.02 6.497L2 4.28Zm3.523 1.238h4.953L7.99 8.184 5.523 5.517Z"
      fill="#E2E2E8"
    />
    <Path d="m7.991 5.257 2.48-2.675L7.99 6.66V5.257Z" fill="#8C8CA1" />
    <Path d="M7.993 5.257 5.529 2.582 7.993 6.66V5.257Z" fill="#8C8CA1" />
    <Path d="M10.47 2.582H5.53l2.462 2.675 2.479-2.675Z" fill="#E2E2E8" />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgNexa;
