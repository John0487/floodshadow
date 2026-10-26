import { runBenchmark } from "./evaluation.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: runBenchmark(data.features, data.params, data.k, data.runs),
    });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
