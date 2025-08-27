declare module "./.open-next/worker.js" {
  // Minimaler Typ für den generierten Worker
  const worker: {
    fetch: (req: Request, env: unknown, ctx: ExecutionContext) => Response | Promise<Response>;
  };
  export default worker;

  // Platzhalter-Typen für die von OpenNext generierten DO-Klassen
  export class DOQueueHandler {}
  export class DOShardedTagCache {}
}
