import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCallCancel = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M20.707 4.707a1 1 0 0 0-1.414-1.414l-8.456 8.456a12.045 12.045 0 0 1-1.049-1.444c-.135-.218-.118-.56.149-.827a2.825 2.825 0 0 0 .708-2.81l-.46-1.53A3 3 0 0 0 7.313 3H6.001C4.38 3 2.91 4.344 3.13 6.12a16.936 16.936 0 0 0 4.162 9.173l-4 4a1 1 0 1 0 1.414 1.414l16-16ZM17.881 20.87a16.908 16.908 0 0 1-7.592-2.916l3.661-3.66a.732.732 0 0 0 .573-.23 2.825 2.825 0 0 1 2.809-.709l1.53.46a3 3 0 0 1 2.139 2.873V18c0 1.619-1.344 3.09-3.12 2.87Z"
    />
  </Svg>
);
export default SvgCallCancel;
