import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgHotSpot = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.161 3h9.678c.527 0 .982 0 1.356.03.395.033.789.104 1.167.297a3 3 0 0 1 1.311 1.311c.193.378.264.772.296 1.167.031.375.031.83.031 1.356v9.678c0 .527 0 .982-.03 1.356-.033.395-.104.789-.297 1.167a3 3 0 0 1-1.311 1.311c-.378.193-.772.264-1.167.296-.375.031-.83.031-1.356.031H7.16c-.527 0-.981 0-1.356-.03-.395-.033-.789-.104-1.167-.297a3 3 0 0 1-1.311-1.311c-.193-.378-.264-.772-.296-1.167A17.9 17.9 0 0 1 3 16.839V7.16c0-.527 0-.981.03-1.356.033-.395.104-.789.297-1.167a3 3 0 0 1 1.311-1.311c.378-.193.772-.264 1.167-.296C6.18 3 6.635 3 7.161 3ZM12 7a8.954 8.954 0 0 0-4.503 1.208 1 1 0 0 0 1.006 1.728A6.954 6.954 0 0 1 12 9c1.215 0 2.427.313 3.497.936a1 1 0 0 0 1.006-1.728A8.954 8.954 0 0 0 12 7Zm0 5.75c-.54 0-1.078.118-1.57.352a1 1 0 0 1-.86-1.806A5.657 5.657 0 0 1 12 10.75c.83 0 1.663.181 2.43.546a1 1 0 1 1-.86 1.806A3.66 3.66 0 0 0 12 12.75ZM12 17a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHotSpot;
