import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUnity = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 20.5V18m0-12V3.5M6.598 9 4.5 7.789m0 8.422L6.598 15M19.5 16.211 17.402 15m0-6L19.5 7.789M17.743 6.23l1.747.983a1 1 0 0 1 .51.872V10m0 4v1.915a1 1 0 0 1-.51.872l-1.747.983m-3.564 2.004-1.689.95a1 1 0 0 1-.98 0l-1.69-.95M6.258 17.77l-1.747-.983a1 1 0 0 1-.51-.872V14m0-4V8.085a1 1 0 0 1 .51-.871l1.747-.984m3.564-2.004 1.689-.95a1 1 0 0 1 .98 0l1.69.95M12 12v2m0-2-1.732-1M12 12l1.732-1"
    />
  </Svg>
);
export default SvgUnity;
