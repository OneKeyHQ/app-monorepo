import { MotiView } from 'moti';

import { Box, Icon } from '@onekeyhq/components';

function SelectedIndicator({
  multiSelect,
  selected,
  width,
}: {
  multiSelect?: boolean;
  selected: boolean;
  width: number;
}) {
  if (multiSelect === false && selected === false) {
    return null;
  }
  return (
    <Box
      borderRadius="full"
      justifyContent="center"
      alignItems="center"
      bgColor="icon-on-primary"
      size={`${width}px`}
    >
      {selected && (
        <MotiView
          from={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'timing', duration: 150 }}
        >
          <Icon
            name="CheckCircleMini"
            color="interactive-default"
            size={width}
          />
        </MotiView>
      )}
    </Box>
  );
}
export { SelectedIndicator };
