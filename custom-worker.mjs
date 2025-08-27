// custom-worker.mjs
import worker, { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
export default { fetch: worker.fetch };
export { DOQueueHandler, DOShardedTagCache };
