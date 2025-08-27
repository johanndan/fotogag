import handler from "./.open-next/worker.js";
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
export default {
  fetch: handler.fetch,
};