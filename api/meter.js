const express = require("express");

module.exports = function ({ logger, send, store, getMeterData }) {
  const router = express.Router();

  /**
   * @typedef RawPoint
   * @property {int} value.required - Measured value - eg: 1234
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {boolean} isEstimated.required - Indication of value is estimated or final - eg: false, true
   */

  /**
   * @typedef RawStatistics
   * @property {int} maximum.required - Measured maximum value - eg: 999
   * @property {int} minimum.required - Measured minimum value - eg: 333
   * @property {int} average.required - Measured average value - eg: 666
   */

  /**
   * @typedef Raw
   *  @property {boolean} quarter-hour-opt-in.required - Status of opt-in - eg: false, true
   * @property {Array.<RawPoint>} values.required - Measured values
   * @property {RawStatistics.model} statistics.required - min, max, avg values
   */

  /**
   * @typedef Point
   * @property {enum} measurement.required - Type of measurement - eg: Consumption,Load_Avg
   * @property {enum} unit.required - Unit of value - eg: Wh,kWh,W
   * @property {int} value.required - Measured value - eg: 1234
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} start.required - Start of periode, ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} end.required - End of periode, ISO timestamp - eg: 2023-12-31T15:14:59.999Z
   * @property {string} text - Value as formated text - eg: 1.2kWh
   */

  /**
   * @typedef QuarterHours
   * @property {Array.<Point>} consumption.required - Measured consumption
   * @property {Array.<Point>} load.required - Measured load
   */

  /**
   * @typedef Hours
   * @property {Array.<Point>} consumption.required - Measured consumption
   */

  /**
   * @typedef Day
   * @property {Array.<Point>} consumption.required - Measured consumption
   */

  /**
   * @typedef Measurements
   * @property {string} meter.required - ID of smartmeter - eg: AT0010000000000000001xxxxxxxxxxxx
   * @property {string} measured.required - Day of measurement, ISO timestamp - eg: 2023-12-01T22:00:00.000Z
   * @property {string} retrieved.required - Day when data was retrieved, ISO timestamp - eg: 2023-12-02T08:00:01.700Z
   * @property {boolean} valid.required - True, if data is correct and not estimated - eg: false, true
   * @property {Raw.model} raw.required - Raw data received
   * @property {QuarterHours.model} quarterHours.required - Raw data received
   * @property {Hours.model} hours.required - Raw data received
   * @property {Day.model} day.required - Raw data received
   */

  /**
   * @typedef Log
   * @property {Array.<LogEntry>} log.required - severity level - eg: error, debug, warn, data, info, verbose, silly
   */

  /**
   * Get log
   * @route GET /meter/{date}
   * @group METER
   * @param {string} [date.path] - Date of the measurement (YYYY-MM-DD). (default: yesterday) - e.g. 2023-12-31
   * @param {enum} [scope.query = full] - Scope of response - eg: full,raw,consumption,load,hours,day
   * @param {boolean} [store.query = false] - Define if the retrieved date should be stored in the database. (default: false) - eg: false, true
   * @param {boolean} [notify.query = false] - Define if notifications (webhook, email) should be sent after a store attempt to the database. (default: false) - eg: false, true
   * @param {enum} [format.query = json] - Format of the resonse (default: json) - eg: json,html
   * @produces application/json application/xhtml+xml
   * @returns {Measurements.model} Measurement data
   */

  router.get("/meter/:date?", async (request, response) => {
    try {
      const date =
        String(request.params?.date).toLowerCase() === "yesterday" ||
        String(request.params?.date).toLowerCase() === "{date}" ||
        String(request.params?.date).toLowerCase() === "undefined" ||
        request.params?.date === undefined
          ? undefined // fix for swagger
          : String(request.params?.date || "").slice(0, 10) || undefined;

      logger.verbose("[API] GET /meter/:date?", date);
      const data = await getMeterData(date);

      let responseData = {};

      switch (String(request.query?.scope || "full").toLowerCase()) {
        case "raw":
          responseData = data?.raw;
          break;
        case "consumption":
          responseData = data?.quarterHours?.consumption;
          break;
        case "load":
          responseData = data?.quarterHours?.load;
          break;
        case "hours":
          responseData = data?.hours?.consumption;
          break;
        case "day":
          responseData = data?.day?.consumption;
          break;
        case "full":
        default:
          responseData = data;
      }

      send({ request, response, data: responseData });

      if (
        !!data &&
        (request.query?.save === true ||
          String(request.query?.store).toLowerCase() === "true")
      ) {
        store(
          data,
          String(request.query?.notify).toLowerCase() === "true" ? true : false
        );
      }
    } catch (error) {
      logger.error("[API] /meter/:date", error);
      response.status(500).json({ error });
    }
  });

  return router;
};
