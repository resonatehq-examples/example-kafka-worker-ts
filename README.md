# Example: Kafka Worker (TypeScript)

> **Status**: Planned - See [Python implementation](../example-kafka-worker-py) for working example

## Overview

This example will demonstrate building a durable Kafka/RedPanda worker using the TypeScript SDK. A Python implementation already exists and serves as the reference for this TypeScript port.

## What This Demonstrates

### Problem: Head-of-Line Blocking
Traditional Kafka consumers process messages sequentially. If the first message triggers a 1-hour operation and the next would take 30 seconds, the short job waits unnecessarily.

### Problem: Crash Recovery
If a worker crashes mid-operation across multiple steps, it may redo completed work on restart, causing duplicates or inconsistent state.

### Solution: Resonate + Kafka
Resonate solves both problems:
1. **Concurrent processing** - Handle multiple messages in parallel
2. **Durable execution** - Resume exactly where it left off after crashes

## Architecture

```
Producer → Kafka Topic → Resonate Worker → Kafka Topic → Next Consumer
            (to_delete)   (concurrent)     (deleted)
```

The worker:
- Pulls messages from `records_to_be_deleted` topic
- Spawns concurrent Resonate workflows (one per message)
- Each workflow processes independently with automatic retries
- Pushes completion messages to `records_that_were_deleted` topic

## Use Case: Batch Record Deletion

Messages contain record IDs to delete. The worker:
1. Reads message from Kafka
2. Starts durable workflow for that record ID
3. Simulates batch deletion (unknown data volume)
4. Retries on failures automatically
5. Publishes completion message when done

Multiple workflows run concurrently, so slow deletions don't block fast ones.

## Planned Implementation

### Technologies
- **Kafka Client**: kafkajs
- **Resonate SDK**: @resonatehq/sdk v0.9.6+
- **RedPanda**: Local Kafka-compatible message broker

### Key Files
```
src/
├── producer.ts        # Message producer
├── consumer.ts        # Kafka consumer + Resonate worker
├── workflows.ts       # Deletion workflow (durable)
└── kafka-client.ts    # Kafka connection setup
```

### Workflow Pattern

```typescript
function* batchDeleteRecord(
  ctx: Context,
  recordId: string
): Generator<any, void, any> {
  let remaining = true;

  while (remaining) {
    // Durable batch deletion with automatic retry
    remaining = yield* ctx.run(deleteBatch, recordId);

    if (!remaining) {
      // Publish completion message
      yield* ctx.run(publishCompletion, recordId);
    }
  }
}
```

### Concurrency Pattern

```typescript
// Consume messages and spawn workflows
consumer.on('message', async (message) => {
  const recordId = message.value.toString();

  // Non-blocking: starts workflow and continues
  await resonate.beginRpc(
    `delete/${recordId}`,
    'batchDeleteRecord',
    recordId,
    resonate.options({ target: 'poll://any@workers' })
  );
});
```

## Benefits Over Traditional Approach

| Traditional Worker | Resonate + Kafka Worker |
|-------------------|-------------------------|
| Sequential processing | Concurrent processing |
| Loses progress on crash | Resumes from checkpoint |
| Manual retry logic | Automatic retries |
| Head-of-line blocking | Independent workflows |
| Hard to scale | Horizontal scaling ready |

## Comparison with Python Version

The [Python implementation](../example-kafka-worker-py) demonstrates the same concepts using the Python SDK. Key differences:
- Python uses `async/await` syntax
- TypeScript uses generator functions (`function*` with `yield*`)
- Both SDKs provide the same durability and concurrency guarantees

## Reference Implementation

Until the TypeScript version is built, reference the Python implementation:
- [example-kafka-worker-py](../example-kafka-worker-py)

## Related Examples

- [example-load-balancing-ts](../example-load-balancing-ts) - Worker pool patterns
- [example-async-rpc-py](../example-async-rpc-py) - Cross-process workflows
- [example-countdown-kafka-ts](../example-countdown-kafka-ts) - Kafka triggers

## Contributing

This TypeScript port is planned but not yet implemented. To contribute:
1. Review the [Python implementation](../example-kafka-worker-py) for reference
2. Follow patterns from [resonate-develop-typescript](../../resonate-skills/resonate-develop-typescript)
3. Use kafkajs for Kafka client integration
4. Include Docker Compose setup with RedPanda
5. Add tests for concurrency and crash recovery

---

**Interested in building this?** [Open an issue](https://github.com/resonatehq-examples/example-kafka-worker-ts/issues) or reach out on [Discord](https://discord.gg/R4har9w6).
