/** Replica width on the stage, in pt. */
export const REPLICA_WIDTH = 280;

/**
 * Port height: the crop keeps the screen and keys, and the port's mask
 * dissolves the foot — the device itself fades out, so the treatment works
 * over paint and glass alike.
 */
export const PORT_HEIGHT = 376;

/**
 * The compact arrangement (the confirm step): the replica shrinks to a
 * full-body miniature. Scale is the flow spec's 80/290; the port height
 * covers the tallest shell the window means to show whole — the Touch,
 * 280 wide x its aspect x scale ≈ 129.6 — so the Classic, Pro, Pro 2 and
 * Touch miniatures all keep their feet, the foot dissolve below the box.
 * The Mini's tall body (~166.7 scaled) still overruns and loses its foot
 * to the window: accepted (2026-08-31). A per-model port is not a
 * drop-in: the port value doubles as the compact/full discriminator and
 * as the height-arrange token in DeviceStage, so those roles would need
 * their own flag first.
 */
export const COMPACT_SCALE = 0.276;
export const COMPACT_PORT_HEIGHT = 130;
