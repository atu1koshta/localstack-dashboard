const { Router } = require("express");
const {
  LambdaClient, ListFunctionsCommand, GetFunctionCommand, InvokeCommand,
} = require("@aws-sdk/client-lambda");
const {
  CloudWatchLogsClient, FilterLogEventsCommand,
} = require("@aws-sdk/client-cloudwatch-logs");
const { clientConfig } = require("../aws-client");

const router = Router();
const lambda = new LambdaClient(clientConfig);
const logs = new CloudWatchLogsClient(clientConfig);

router.get("/functions", async (_req, res) => {
  const { Functions } = await lambda.send(new ListFunctionsCommand({}));
  res.json(
    (Functions || []).map((f) => ({
      name: f.FunctionName,
      runtime: f.Runtime,
      handler: f.Handler,
      memory: f.MemorySize,
      timeout: f.Timeout,
      lastModified: f.LastModified,
    }))
  );
});

router.get("/functions/:name", async (req, res) => {
  const data = await lambda.send(new GetFunctionCommand({ FunctionName: req.params.name }));
  res.json({ config: data.Configuration, tags: data.Tags });
});

router.post("/functions/:name/invoke", async (req, res) => {
  const result = await lambda.send(
    new InvokeCommand({
      FunctionName: req.params.name,
      Payload: JSON.stringify(req.body.payload || {}),
    })
  );
  const payload = result.Payload ? new TextDecoder().decode(result.Payload) : null;
  res.json({
    statusCode: result.StatusCode,
    payload: payload ? JSON.parse(payload) : null,
    error: result.FunctionError || null,
  });
});

router.get("/functions/:name/logs", async (req, res) => {
  const logGroupName = `/aws/lambda/${req.params.name}`;
  const startTime = req.query.since ? parseInt(req.query.since) : Date.now() - 3600000;
  try {
    const { events, nextToken } = await logs.send(
      new FilterLogEventsCommand({ logGroupName, startTime, nextToken: req.query.nextToken || undefined, limit: 100 })
    );
    res.json({ events: events || [], nextToken });
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      res.json({ events: [], nextToken: null });
    } else {
      throw err;
    }
  }
});

module.exports = router;
