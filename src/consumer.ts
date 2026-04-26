import {
  kafka,
  TOPIC_TO_DELETE,
  CONSUMER_GROUP_ID,
} from "./kafka-config.ts";
import { resonate } from "./workflow.ts";

async function main(): Promise<void> {
  // Importing ./workflow.ts above instantiates the Resonate client and
  // registers the workflow function — that's all the worker needs to start
  // accepting invocations on this process.
  console.log("processor running");

  const consumer = kafka.consumer({ groupId: CONSUMER_GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({
    topic: TOPIC_TO_DELETE,
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ message, partition, topic }) => {
      const raw = message.value?.toString("utf-8");
      if (!raw) return;

      let recordId: string;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "string") {
          recordId = parsed;
        } else if (Array.isArray(parsed) && typeof parsed[0] === "string") {
          recordId = parsed[0];
        } else {
          console.error(`unexpected message shape on ${topic}: ${raw}`);
          return;
        }
      } catch (err) {
        console.error(`failed to parse message on ${topic}: ${(err as Error).message}`);
        return;
      }

      const offset = message.offset;
      try {
        // beginRun is non-blocking: it kicks off (or recovers) the workflow
        // identified by recordId and returns a handle. The recordId acts as
        // the durable promise id, so duplicate invocations dedupe.
        await resonate.beginRun(
          recordId,
          "workflow",
          recordId,
          offset,
        );
        console.log(
          `kicked off workflow for record ${recordId} (partition=${partition}, offset=${offset})`,
        );
      } catch (err) {
        console.error(`failed to begin workflow for ${recordId}:`, err);
      }
    },
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("shutting down consumer.");
    try {
      await consumer.disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
