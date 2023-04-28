"use strict";

const fs = require("fs");
const winston = require("winston");
require("winston-daily-rotate-file");

const DEFAULT_LEVEL = "error";
const DEFAULT_SILENT = false;
const DEFAULT_DIRNAME = "./logs";
const DEFAULT_FILENAME = "log";

class Logger {
  #logger;
  #lastFile;

  constructor(
    {
      level = DEFAULT_LEVEL,
      silent = DEFAULT_SILENT,
      filename = DEFAULT_FILENAME,
      dirname = DEFAULT_DIRNAME,
    } = {
      level: DEFAULT_LEVEL,
      silent: DEFAULT_SILENT,
      filename: DEFAULT_FILENAME,
      dirname: DEFAULT_DIRNAME,
    }
  ) {
    winston.addColors(Logger.colors);

    const transportConsole = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(
          ({ level, timestamp, message, details, ...rest }) => {
            return ""
              .concat(this.#formatDate(timestamp), " ")
              .concat(level.toLocaleUpperCase(), ": ")
              .concat(message, " ")
              .concat(
                details && JSON.stringify(details).length > 2
                  ? JSON.stringify(details)
                  : ""
              );
          }
        ),
        winston.format.colorize({ all: true })
      ),
    });

    const transportFile = new winston.transports.DailyRotateFile({
      dirname,
      filename: filename + "_%DATE%.json",
      datePattern: "YYYY-MM-DD",
      zippedArchive: false,
      maxSize: "10m",
      maxFiles: "7d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((data) => JSON.stringify(data) + ",")
      ),
    });

    transportFile.on("new", (filename) => {
      this.#lastFile = filename;
    });

    this.#logger = winston.createLogger({
      levels: Logger.levels,
      level,
      silent,
      transports: [transportConsole, transportFile],
    });
  }

  static locale = "de-AT";

  static levels = {
    error: 0,
    debug: 1,
    warn: 2,
    data: 3,
    info: 4,
    verbose: 5,
    silly: 6,
  };
  static colors = {
    error: "red",
    debug: "blue",
    warn: "yellow",
    data: "magenta",
    info: "green",
    verbose: "cyan",
    silly: "grey",
  };

  #formatDate = (date) =>
    date
      ? new Date(date).toLocaleDateString(Logger.locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;

  log = (message, ...details) =>
    this.#logger.log({ level: "info", message, details });
  error = (message, ...details) =>
    this.#logger.log({ level: "error", message, details });
  debug = (message, ...details) =>
    this.#logger.log({ level: "debug", message, details });
  warn = (message, ...details) =>
    this.#logger.log({ level: "warn", message, details });
  data = (message, ...details) =>
    this.#logger.log({ level: "data", message, details });
  info = (message, ...details) =>
    this.#logger.log({ level: "info", message, details });
  verbose = (message, ...details) =>
    this.#logger.log({ level: "verbose", message, details });
  silly = (message, ...details) =>
    this.#logger.log({ level: "silly", message, details });

  getLog = () => {
    try {
      const data = fs.readFileSync(this.#lastFile);
      return JSON.parse("[" + String(data).trim().slice(0, -1) + "]");
    } catch (e) {
      this.error("[Logger] Can not read/parse log file", e);
      return [];
    }
  };

  getRecent = (count = 5, level = "error") => {
    try {
      return (this.getLog() || [])
        .filter((entry) => entry.level === level)
        .slice(-count)
        .reverse();
    } catch (e) {
      return [];
    }
  };
}

module.exports = Logger;
