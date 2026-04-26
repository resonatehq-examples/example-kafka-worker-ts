import { kafka, TOPIC_TO_DELETE, TOPIC_DELETED } from "./kafka-config.ts";

async function main(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const created = await admin.createTopics({
      topics: [
        { topic: TOPIC_TO_DELETE, numPartitions: 1, replicationFactor: 1 },
        { topic: TOPIC_DELETED, numPartitions: 1, replicationFactor: 1 },
      ],
      waitForLeaders: true,
    });
    if (created) {
      console.log(`Topics created: ${TOPIC_TO_DELETE}, ${TOPIC_DELETED}`);
    } else {
      console.log("Topics already exist.");
    }
  } catch (err) {
    console.error("Failed to create topics:", err);
    process.exitCode = 1;
  } finally {
    await admin.disconnect();
  }
}

main();
