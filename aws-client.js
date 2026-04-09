const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";
const REGION = process.env.AWS_REGION || "us-east-1";

const clientConfig = {
  endpoint: LOCALSTACK_ENDPOINT,
  region: REGION,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  forcePathStyle: true,
};

module.exports = { clientConfig, LOCALSTACK_ENDPOINT, REGION };
