
const errorMiddleware = (err, req, res, next) => {
  let statusCode =
    res.statusCode >= 400 ? res.statusCode : 500;

  let message = err.message || "Internal Server Error";

  if (err.code === 11000) {
    statusCode = 409;
    message = "A record with this information already exists";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Database validation failed";
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource identifier";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};

export default errorMiddleware;
