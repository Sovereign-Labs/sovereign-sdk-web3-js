import winston from "winston";

const level = process.env.NODE_ENV !== "production" ? "verbose" : "info";

const logger = winston.createLogger({
  level,
  format: winston.format.json(),
  transports: [
    // adding later, just use console for now/development
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}

export default logger;
