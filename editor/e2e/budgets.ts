import type { Measurements } from './responsiveness'

/** For 3,000 datasets at CPU_THROTTLE=4 (#29), in ms or MB for the heap. Proposed; to be agreed with the product owner. */
export const BUDGETS: Measurements = {
  firstView: 5_000,
  heapAfterLoad: 500,
  scroll: 100,
  filterKey: 100,
  select: 100,
  edit: 200,
  validate: 2_000,
  export: 2_000,
  heapAfterActions: 500,
}
