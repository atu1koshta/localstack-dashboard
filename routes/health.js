const { Router } = require("express");
const { LOCALSTACK_ENDPOINT } = require("../aws-client");
const router = Router();

const HIDDEN_SERVICES = new Set([
  "acm", "apigateway", "config", "dynamodbstreams", "ec2", "es", "events",
  "firehose", "kinesis", "opensearch", "redshift", "resource-groups",
  "resourcegroupstaggingapi", "route53", "route53resolver", "s3control",
  "scheduler", "secretsmanager", "ses", "ssm", "stepfunctions", "support",
  "swf", "transcribe",
]);

router.get("/", async (_req, res) => {
  const resp = await fetch(`${LOCALSTACK_ENDPOINT}/_localstack/health`);
  const data = await resp.json();
  if (data.services) {
    data.services = Object.fromEntries(
      Object.entries(data.services).filter(([name]) => !HIDDEN_SERVICES.has(name))
    );
  }
  res.json(data);
});

module.exports = router;
