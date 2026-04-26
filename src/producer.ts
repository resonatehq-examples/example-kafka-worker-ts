import { randomUUID } from "node:crypto";
import { kafka, TOPIC_TO_DELETE } from "./kafka-config.ts";

function parseCount(): number {
  const flagIdx = process.argv.findIndex((a) => a === "-n" || a === "--number");
  if (flagIdx === -1) {
    console.error("Usage: bun run produce -- -n <count>");
    process.exit(1);
  }
  const raw = process.argv[flagIdx + 1];
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isInteger(n) || n < 1) {
    console.error("`-n` must be a positive integer");
    process.exit(1);
  }
  return n;
}

async function main(): Promise<void> {
  const n = parseCount();
  const producer = kafka.producer();
  await producer.connect();

  const messages = Array.from({ length: n }, () => {
    const id = randomUUID().replace(/-/g, "");
    return { value: JSON.stringify(id) };
  });

  const result = await producer.send({
    topic: TOPIC_TO_DELETE,
    messages,
  });

  for (const r of result) {
    console.log(
      `Record produced to ${r.topicName} [${r.partition}] at offset ${r.baseOffset}`,
    );
  }

  console.log(`Produced ${n} messages.`);
  await producer.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
