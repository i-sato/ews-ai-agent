// Tipe tampilan untuk lapisan interface (komponen tidak boleh mengimpor domain langsung, §4.2).
export type { Category, ItemSummary, ProgressSummary } from "../domain/progress-summary";
export type { ItemType } from "../domain/item-type";
export type { ItemStatus } from "../domain/status-mapping";
export type { ScheduleState, TrainingPhase } from "../domain/training-period";
