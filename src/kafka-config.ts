import { Kafka, type KafkaConfig } from "kafkajs";

export const BOOTSTRAP_SERVERS = ["localhost:9092"];
export const TOPIC_TO_DELETE = "records_to_be_deleted";
export const TOPIC_DELETED = "records_that_were_deleted";
export const CONSUMER_GROUP_ID = "record_consumer_group";

const kafkaConfig: KafkaConfig = {
  clientId: "example-kafka-worker-ts",
  brokers: BOOTSTRAP_SERVERS,
};

export const kafka = new Kafka(kafkaConfig);
