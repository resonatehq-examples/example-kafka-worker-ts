import { randomUUID } from "node:crypto";
import { Resonate, type Context } from "@resonatehq/sdk";
import { kafka, TOPIC_DELETED } from "./kafka-config.ts";

const appNodeId = randomUUID();
const appNodeGroup = "workers";

export const resonate = new Resonate({
  url: "http://localhost:8001",
  group: appNodeGroup,
  pid: appNodeId,
});

// A reusable producer for "completion" messages. We connect lazily on the
// first publish from this worker process.
const producer = kafka.producer();
let producerConnected = false;

async function ensureProducerConnected(): Promise<void> {
  if (!producerConnected) {
    await producer.connect();
    producerConnected = true;
  }
}

// Step 1: simulate deleting a batch of rows for a record id.
// 25% chance of a transient error (Resonate will retry automatically).
// 25% chance the deletion is "done" — returns false to stop the loop.
function deleteBatch(_ctx: Context, recordId: string): boolean {
  console.log(`deleting a batch of rows related to record ${recordId}`);
  if (Math.floor(Math.random() * 100) < 25) {
    console.log(`simulated error while processing record ${recordId}`);
    throw new Error(`simulated error while processing record ${recordId}`);
  }
  if (Math.floor(Math.random() * 100) < 25) {
    return false;
  }
  return true;
}

// Step 2: publish a completion message to the "deleted" topic.
async function enqueueCompletion(
  _ctx: Context,
  recordId: string,
  previousOffset: string,
): Promise<void> {
  await ensureProducerConnected();
  const payload = JSON.stringify([recordId, previousOffset]);
  await producer.send({
    topic: TOPIC_DELETED,
    messages: [{ value: payload }],
  });
}

// The durable workflow: loop until deleteBatch returns false, then publish
// the completion message. Each `yield* ctx.run(...)` is a checkpoint — if the
// worker crashes mid-flight, Resonate replays from the last checkpoint.
export function* workflow(
  ctx: Context,
  recordId: string,
  offset: string,
): Generator<any, void, any> {
  console.log(`processing record ${recordId} in position ${offset}`);
  while (yield* ctx.run(deleteBatch, recordId)) {
    console.log(`record ${recordId} still has rows to delete`);
    yield* ctx.sleep(5_000);
  }
  console.log(`all rows deleted for record ${recordId} in position ${offset}`);
  yield* ctx.run(enqueueCompletion, recordId, offset);
}

resonate.register("workflow", workflow);
