import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbtack = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.5 5a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v2.229c0 1.509.6 2.956 1.667 4.023A2.85 2.85 0 0 1 20 13.264V15a1 1 0 0 1-1 1h-6v5a1 1 0 1 1-2 0v-5H5a1 1 0 0 1-1-1v-1.736c0-.754.3-1.478.833-2.012A5.69 5.69 0 0 0 6.5 7.23V5Zm3-1a1 1 0 0 0-1 1v2.229a7.69 7.69 0 0 1-2.252 5.438.845.845 0 0 0-.248.597V14h12v-.736a.846.846 0 0 0-.248-.597A7.69 7.69 0 0 1 15.5 7.229V5a1 1 0 0 0-1-1h-5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbtack;
