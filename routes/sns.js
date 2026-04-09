const { Router } = require("express");
const {
  SNSClient, ListTopicsCommand, GetTopicAttributesCommand,
  ListSubscriptionsByTopicCommand, CreateTopicCommand, DeleteTopicCommand,
  SubscribeCommand, UnsubscribeCommand, PublishCommand,
} = require("@aws-sdk/client-sns");
const { clientConfig } = require("../aws-client");

const router = Router();
const sns = new SNSClient(clientConfig);

router.get("/topics", async (_req, res) => {
  const { Topics } = await sns.send(new ListTopicsCommand({}));
  const topics = [];
  for (const t of Topics || []) {
    try {
      const { Attributes } = await sns.send(new GetTopicAttributesCommand({ TopicArn: t.TopicArn }));
      topics.push({ arn: t.TopicArn, attributes: Attributes });
    } catch {
      topics.push({ arn: t.TopicArn, attributes: {} });
    }
  }
  res.json(topics);
});

router.get("/topics/:arn(*)/subscriptions", async (req, res) => {
  const { Subscriptions } = await sns.send(
    new ListSubscriptionsByTopicCommand({ TopicArn: req.params.arn })
  );
  res.json(Subscriptions || []);
});

router.post("/topics", async (req, res) => {
  const result = await sns.send(new CreateTopicCommand({ Name: req.body.name }));
  res.json({ arn: result.TopicArn });
});

router.delete("/topics/:arn(*)", async (req, res) => {
  await sns.send(new DeleteTopicCommand({ TopicArn: req.params.arn }));
  res.json({ ok: true });
});

router.post("/topics/:arn(*)/publish", async (req, res) => {
  const result = await sns.send(
    new PublishCommand({
      TopicArn: req.params.arn,
      Message: req.body.message,
      Subject: req.body.subject || undefined,
    })
  );
  res.json({ messageId: result.MessageId });
});

router.post("/topics/:arn(*)/subscribe", async (req, res) => {
  const result = await sns.send(
    new SubscribeCommand({
      TopicArn: req.params.arn,
      Protocol: req.body.protocol,
      Endpoint: req.body.endpoint,
    })
  );
  res.json({ subscriptionArn: result.SubscriptionArn });
});

router.delete("/subscriptions/:arn(*)", async (req, res) => {
  await sns.send(new UnsubscribeCommand({ SubscriptionArn: req.params.arn }));
  res.json({ ok: true });
});

module.exports = router;
