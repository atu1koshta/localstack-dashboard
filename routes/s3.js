const { Router } = require("express");
const {
  S3Client, ListBucketsCommand, ListObjectsV2Command,
  CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { clientConfig } = require("../aws-client");

const router = Router();
const s3 = new S3Client(clientConfig);

router.get("/buckets", async (_req, res) => {
  const { Buckets } = await s3.send(new ListBucketsCommand({}));
  res.json(Buckets || []);
});

router.get("/buckets/:name/objects", async (req, res) => {
  const { Contents, CommonPrefixes } = await s3.send(
    new ListObjectsV2Command({
      Bucket: req.params.name,
      Prefix: req.query.prefix || "",
      Delimiter: "/",
    })
  );
  res.json({ objects: Contents || [], prefixes: CommonPrefixes || [] });
});

router.post("/buckets", async (req, res) => {
  await s3.send(new CreateBucketCommand({ Bucket: req.body.name }));
  res.json({ ok: true });
});

router.delete("/buckets/:name", async (req, res) => {
  await s3.send(new DeleteBucketCommand({ Bucket: req.params.name }));
  res.json({ ok: true });
});

router.delete("/buckets/:name/objects/:key(*)", async (req, res) => {
  await s3.send(new DeleteObjectCommand({ Bucket: req.params.name, Key: req.params.key }));
  res.json({ ok: true });
});

module.exports = router;
