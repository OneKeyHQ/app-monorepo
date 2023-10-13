import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArchiveBox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a2 2 0 0 0-2 2v4.008a4.034 4.034 0 0 0-.138.009 2.022 2.022 0 0 0-.77.201 2 2 0 0 0-.874.874 2.022 2.022 0 0 0-.201.77C3 10.07 3 10.316 3 10.568v6.27c0 .528 0 .982.03 1.357.033.395.104.789.297 1.167a3 3 0 0 0 1.311 1.311c.378.193.772.264 1.167.296.375.031.83.031 1.356.031h9.678c.527 0 .982 0 1.356-.03.395-.033.789-.104 1.167-.297a3 3 0 0 0 1.311-1.311c.193-.378.264-.772.296-1.167.031-.375.031-.83.031-1.356v-6.27c0-.253 0-.5-.017-.707a2.022 2.022 0 0 0-.201-.77 2 2 0 0 0-.874-.874 2.022 2.022 0 0 0-.77-.201A4.022 4.022 0 0 0 19 8.008V6a2 2 0 0 0-2-2h-4.086L11.5 2.586A2 2 0 0 0 10.086 2H7Zm10 6V6h-4.086a2 2 0 0 1-1.414-.586L10.086 4H7v4h10ZM7 13a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArchiveBox;
