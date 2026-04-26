<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/banner-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/banner-light.png">
    <img alt="Kafka Worker — Resonate example" src="./assets/banner-dark.png">
  </picture>
</p>

# Dead Simple Kafka Worker

**Resonate TypeScript SDK**

This example app uses Redpanda as the drop-in replacement for an actual Apache Kafka implementation.
It showcases what a Redpanda + Resonate pipeline might look like in the context of a "batch record deletion" use case.

Instructions on [How to run this example](#how-to-run-the-example) are below.

### Use case

Imagine a worker process that pulls messages from a queue, performs the requested task, and then pushes a completion message to another queue.

Problem one: head-of-line blocking.
If the first message kicks off a long operation — say, an hour — and the next one would only take 30 seconds, the shorter job gets stuck waiting. Unless the worker supports concurrency, this kills efficiency.

Problem two: crashes and repeat work.
If a task involves multiple steps and the worker crashes halfway through, it may redo already-completed steps when it restarts, leading to duplicate work or unintended side effects.

The bottom line is a worker node sitting between two queues should do two things well:

1. Handle tasks concurrently to stay efficient.
2. Resume cleanly after crashes to stay reliable.

This example application showcases an integration between Redpanda and Resonate where Resonate does both of those things, extending the durability Redpanda provides to span between the Redpanda topics and efficiently making progress on operations without blocking on the head-of-the-line message.

To illustrate these points, the Resonate Application Node in this example app pretends to be a process that deletes records. It pulls messages off a topic / queue, each message containing the ID of a record that needs to be permanently deleted. We don't know how much data is related to the record ID, so the application simulates a random amount. Once the operation is complete, and the data deleted, the application node puts a new message onto a different queue where we can assume some other component would then take the next steps, perhaps notifying someone of deletion.

### Application flow details

In this example we have a producer script (`src/producer.ts`) which creates a set of messages, each containing a unique ID, and puts the messages onto a Redpanda topic / queue named `records_to_be_deleted`.

Then we have a consumer process (`src/consumer.ts`) which pulls messages off the `records_to_be_deleted` topic / queue and kicks off a Resonate workflow for each one. The workflow simulates a batch deletion of data associated with the IDs. The application assumes that there is no way to know how much data there is to delete in relation to a record ID. The `deleteBatch()` step simulates the following:

1. A 25% chance of encountering an error while deleting the rows. This showcases Resonate's automatic function execution retry feature.
2. A 25% chance that any given batch deletion has deleted all remaining rows associated with the record ID. That is — on each attempt to delete rows for a given ID, there is a 25% chance that the workflow completes for that ID, which realistically simulates an unknown amount of time.

The Resonate Application Node pulls messages off the queue (`records_to_be_deleted`) in the order in which they are placed there (FIFO) and kicks off a workflow for each message that it pulls off using `resonate.beginRun(...)` — a non-blocking call that lets the consumer move on to the next message immediately.

When there are no more rows to delete, the workflow puts a new message onto a different topic / queue (`records_that_were_deleted`) which we can assume will be monitored by some other processing node that might notify someone or something that the data is deleted. The message on that topic / queue includes the offset of the produced message and this enables us to see how the ordering changed from the first message off of the `records_to_be_deleted` topic / queue to the first message onto the `records_that_were_deleted` topic / queue.

The Resonate SDK is built so that new workflows can be invoked at any time, even if existing workflows are in progress.

### Recovery

This example is designed to demonstrate Resonate's ability to recover and resume progress on workflows.

While running the example app, try killing the consumer, then bring it back up and see the progress resume.

Or, try running multiple consumers and kill the one taking the lead. You will see the other one pick up and resume progress from where the first one left off.

## How to run the example

This application uses [bun](https://bun.sh) (or any Node 20+ runtime) to execute TypeScript via `tsx`.
This application requires Docker and Docker Compose.

Run the Resonate Server:

```shell
brew install resonatehq/tap/resonate
resonate serve
```

Install dependencies:

```shell
bun install
```

Run Redpanda in Docker:

```shell
docker compose up
```

Set up the topics (optional — running the producer and consumer will automatically create the topics):

```shell
bun run setup-topics
```

Run the consumer:

```shell
bun run consume
```

Create records:

```shell
bun run produce -- -n 25
```

You can provide any value for `n`.

### How to view records in Redpanda topics

Redpanda provides a UI in which you can view the records / messages in the topic queues.

- url: http://localhost:8080

The producer script adds records to the `records_to_be_deleted` topic / queue.
The consumer pulls records from the `records_to_be_deleted` topic / queue and adds them to the `records_that_were_deleted` topic / queue.

### How to view Durable Promises in Resonate

You can use the Resonate CLI to view the status of a promise in the Resonate Server.
In this example app, the record ID is used as the Durable Promise ID.

By doing this, we ensure that no duplicate operations will ever happen for a given ID.

You can see the status of a specific workflow / Durable Promise with the following command:

```shell
resonate promises get "<id>"
```

For example:

```shell
resonate promises get "d1b8383d857344c1a74650bcdde82ed0"
```

Or you can see multiple promises using the search command. For example you can use the wildcard to see all promises tracked by the Resonate Server:

```shell
resonate promises search "*"
```

## Related examples

- [example-kafka-worker-py](https://github.com/resonatehq-examples/example-kafka-worker-py) — same pattern in Python.
