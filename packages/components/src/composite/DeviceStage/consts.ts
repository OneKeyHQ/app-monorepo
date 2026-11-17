/** The width the flow spec states the stage's numbers at, in pt: the
 * port, the words' tuck and the compact scale below are all measured
 * against a replica this wide, and DeviceStage scales them to the width
 * in play. */
export const STAGE_DESIGN_WIDTH = 280;

/** Replica width on the stage, in pt — the width in play. Set under the
 * spec's 280 since OK-62091 (the PIN card read as too big on phones:
 * at 220 the card drops from 55% to 47% of an iPhone 17 Pro screen while
 * the device's own screen stays 181pt wide, its keypad still readable).
 * DeviceStage's `replicaWidth` prop overrides it per instance. */
export const REPLICA_WIDTH = 220;

/**
 * Port height at STAGE_DESIGN_WIDTH: the crop keeps the screen and keys,
 * and the port's mask dissolves the foot — the device itself fades out,
 * so the treatment works over paint and glass alike.
 */
export const PORT_HEIGHT = 376;

/**
 * The compact arrangement (the authenticity flow's staged steps): the
 * replica shrinks to a full-body miniature COMPACT_DEVICE_WIDTH wide —
 * the flow spec's 80/290 of the design stage — whatever width the full
 * stage plays at. The port height covers the tallest shell the window
 * means to show whole — the Touch, 77.28 wide x its aspect ≈ 129.6 —
 * so the Classic, Pro, Pro 2 and Touch miniatures all keep their feet,
 * the foot dissolve below the box. The Mini's tall body (~166.7 scaled)
 * still overruns and loses its foot to the window: accepted
 * (2026-08-31). A per-model port is a plain number change: the
 * compact/full discriminator and the height-arrange token in
 * DeviceStage are the arrangement kind, not the port value.
 */
export const COMPACT_SCALE = 0.276;
export const COMPACT_DEVICE_WIDTH = STAGE_DESIGN_WIDTH * COMPACT_SCALE;
export const COMPACT_PORT_HEIGHT = 130;
