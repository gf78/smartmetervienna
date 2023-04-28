"use strict";

const { InfluxDB, Point } = require("@influxdata/influxdb-client");
const Logger = require("./logger.js");

class DB {
  #db;
  #organisation;
  #bucket;
  #measurement;
  #logger;

  constructor(
    { url, token, organisation, bucket, measurement, logger = new Logger() } = {
      url,
      token,
      organisation,
      bucket,
      measurement,
      logger: new Logger(),
    }
  ) {
    this.#db = new InfluxDB({ url, token });
    this.#organisation = typeof organisation === "string" ? organisation : null;
    this.#bucket = typeof bucket === "string" ? bucket : null;
    this.#measurement = typeof measurement === "string" ? measurement : null;
    this.#logger = typeof logger === "object" ? logger : new Logger();
  }

  async write(measurements = []) {
    try {
      this.#logger.verbose("[DB] Write measurements to database ...");

      if (typeof measurements !== "object") {
        this.#logger.error("[DB]: Measurement data is not an object.");
        return false;
      }

      if (!Array.isArray(measurements)) {
        measurements = [measurements];
      }

      const writeApi = this.#db.getWriteApi(this.#organisation, this.#bucket);
      let success = false;

      measurements.every((measurement) => {
        if (
          typeof measurement === "object" &&
          measurement?.value &&
          measurement?.timestamp
        ) {
          const value = Number.parseInt(measurement?.value);
          if (Number.isNaN(value)) {
            this.#logger.error("[DB]: Measurement value is not a number.");
            return true;
          }

          const timestamp = new Date(measurement.timestamp);
          if (Number.isNaN(timestamp)) {
            this.#logger.error(
              "[DB]: Measurement timestamp is not a valid date."
            );
            return true;
          }

          const point = new Point(this.#measurement)
            .intField("value", value)
            .timestamp(timestamp);

          writeApi.writePoint(point);
          success = true;
          return true;
        } else {
          this.#logger.error("[DB]: Measurement is not well formated object.");
          return true;
        }
      });

      await writeApi.close();
      return success;
    } catch (error) {
      this.#logger.error("[DB]: Could not write to database.", error);
      return false;
    }
  }
}

module.exports = DB;
