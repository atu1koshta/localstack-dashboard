require("express-async-errors");
const express = require("express");
const path = require("path");
const errorHandler = require("./middleware/error-handler");

const app = express();
const PORT = process.env.PORT || 3100;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/health", require("./routes/health"));
app.use("/api/s3", require("./routes/s3"));
app.use("/api/sqs", require("./routes/sqs"));
app.use("/api/lambda", require("./routes/lambda"));
app.use("/api/sns", require("./routes/sns"));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`LocalStack UI running at http://localhost:${PORT}`);
});
