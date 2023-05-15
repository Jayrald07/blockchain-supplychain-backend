import { NextFunction } from "express"
import winston, { format } from "winston"

export const logger = async (req: any, _: any, next: NextFunction) => {

  const logger = winston.createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp(),
      format.printf(({ level, message, timestamp }) => `${timestamp} - ${req.ip} [${level}]: ${message}`)
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'combined.log' })
    ]
  });

  req.logger = logger;

  next();

}