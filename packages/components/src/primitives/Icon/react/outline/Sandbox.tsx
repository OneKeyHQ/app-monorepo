import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSandbox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m3.5 16 2.125-2.5M20.5 16l-4.115-3.873m.72-5.12 1.438-.353a1.789 1.789 0 0 0-.178-3.509l-1.408-.198a1.789 1.789 0 0 0-1.138 3.324l1.285.736Zm0 0-.72 5.12M5.776 7.3l-.413.058a1 1 0 0 0-.837 1.208L5.625 13.5m.151-6.2-.139-.99a2 2 0 1 1 3.961-.557l.14.99M5.775 7.3l3.961-.557m0 0 .416-.058a1 1 0 0 1 1.137.928l.328 5.207m-5.993.68 1.134-1.334a2 2 0 0 1 2.375-.514l2.484 1.168m0 0c.247.117.527.146.793.083l3.659-.86a.345.345 0 0 1 .315.084M3 16h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2Z"
    />
  </Svg>
);
export default SvgSandbox;
