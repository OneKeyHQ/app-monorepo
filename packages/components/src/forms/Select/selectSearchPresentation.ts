export function isSelectSearchSheet({
  hasPopoverTrigger,
  isExpandedWindow,
}: {
  hasPopoverTrigger: boolean;
  isExpandedWindow: boolean;
}) {
  // Native anchoring needs a trigger. iPad Settings clamps media `md`, so the
  // trigger is absent and the popover stays a sheet on a wide window.
  return !(hasPopoverTrigger && isExpandedWindow);
}
