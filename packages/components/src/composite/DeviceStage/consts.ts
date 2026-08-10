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
 * full-body miniature. Scale is the flow spec's 80/290; the port height is
 * the whole scaled replica — width x the Slate shell's 1714/1084 aspect x
 * scale — so nothing is cropped and the foot dissolve sits below the box.
 *
 * Derived from the Slate, the model the flow was drawn against. The
 * Classic and Pro are slightly taller for their width, so their miniatures
 * lose a few points of foot to the window here; deriving this per model
 * (each shell fixes its own aspect) is what that would take.
 */
export const COMPACT_SCALE = 0.276;
export const COMPACT_PORT_HEIGHT = 122;
