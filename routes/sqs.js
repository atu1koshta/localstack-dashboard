const { Router } = require("express");
const {
  SQSClient, ListQueuesCommand, GetQueueAttributesCommand,
  SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, PurgeQueueCommand,
} = require("@aws-sdk/client-sqs");
const { clientConfig } = require("../aws-client");

const router = Router();
const sqs = new SQSClient(clientConfig);

router.get("/queues", async (_req, res) => {
  const { QueueUrls } = await sqs.send(new ListQueuesCommand({}));
  const queues = [];
  for (const url of QueueUrls || []) {
    try {
      const { Attributes } = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: url,
          AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"],
        })
      );
      queues.push({ url, attributes: Attributes });
    } catch {
      queues.push({ url, attributes: {} });
    }
  }
  res.json(queues);
});

router.get("/queues/:url(*)/attributes", async (req, res) => {
  const { Attributes } = await sqs.send(
    new GetQueueAttributesCommand({ QueueUrl: req.params.url, AttributeNames: ["All"] })
  );
  res.json(Attributes || {});
});

router.post("/queues/:url(*)/send", async (req, res) => {
  const params = { QueueUrl: req.params.url, MessageBody: req.body.message };
  if (req.params.url.endsWith(".fifo")) {
    params.MessageGroupId = req.body.groupId || "default";
    params.MessageDeduplicationId = Date.now().toString();
  }
  const result = await sqs.send(new SendMessageCommand(params));
  res.json({ messageId: result.MessageId });
});

router.post("/queues/:url(*)/receive", async (req, res) => {
  const { Messages } = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: req.params.url,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
    })
  );
  res.json(Messages || []);
});

router.delete("/queues/:url(*)/message/:receiptHandle(*)", async (req, res) => {
  await sqs.send(new DeleteMessageCommand({ QueueUrl: req.params.url, ReceiptHandle: req.params.receiptHandle }));
  res.json({ ok: true });
});

router.post("/queues/:url(*)/purge", async (req, res) => {
  await sqs.send(new PurgeQueueCommand({ QueueUrl: req.params.url }));
  res.json({ ok: true });
});

module.exports = router;
