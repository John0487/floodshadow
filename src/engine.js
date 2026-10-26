// Stable public API. The v0.2 ranking remains available as a comparator only.
export { random } from "./model/math.js";
export { SCENARIOS, simulate } from "./model/simulator.js";
export { rank, eligible } from "./model/legacy.js";
export {
  infer,
  recommend,
  DEFAULT_PRIOR,
  MODEL_VERSION,
} from "./model/probabilistic.js";
export { evaluate, runBenchmark as benchmark } from "./model/evaluation.js";
