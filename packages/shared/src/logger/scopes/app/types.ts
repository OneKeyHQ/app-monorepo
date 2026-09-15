/**
 * Flattened `availabilitySnapshot` event params: numeric counters keyed by
 * `${source}_${target}_${status}` plus a few window/meta fields. See
 * buildAvailabilitySnapshotParams in request/availabilityAggregator.ts.
 */
export type IAvailabilitySnapshotParams = Record<string, string | number>;
