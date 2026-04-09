module.exports = (err, _req, res, _next) => {
  console.error(`[${new Date().toISOString()}] ${err.name}: ${err.message}`);

  const statusMap = {
    ResourceNotFoundException: 404,
    NoSuchBucket: 404,
    NoSuchKey: 404,
    QueueDoesNotExist: 404,
    NotFoundException: 404,
    ValidationException: 400,
    InvalidParameterValueException: 400,
  };

  const status = statusMap[err.name] || 500;
  res.status(status).json({ error: err.message });
};
