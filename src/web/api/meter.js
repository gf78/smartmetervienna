const express = require("express");

module.exports = function ({ logger, store, meter }) {
  const router = express.Router();

  /**
   * @typedef Measurement
   * @property {int} value.required - Measured value - eg: 1234
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   */

  /**
   * @typedef EnhancedMeasurement
   * @property {enum} measurement.required - Type of measurement - eg: Consumption,Load_Avg
   * @property {enum} unit.required - Unit of value - eg: Wh,kWh,W
   * @property {int} value.required - Measured value - eg: 1234
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} start.required - Start of periode, ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} end.required - End of periode, ISO timestamp - eg: 2023-12-31T15:14:59.999Z
   * @property {string} text.required  - Value as formated text - eg: 1.2kWh
   */

  /**
   * @typedef Raw
   * @property {Array.<Zaehlpunkt>} zaehlpunkte.required - Zählwerke
   */

  /**
   * @typedef Zaehlpunkt
   * @property {Array.<Zaehlwerk>} zaehlwerke.required - Zählwerke
   * @property {string} zuaehlpunkt.required - Zählpunkt - AT0010000000000000001xxxxxxxxxxxx
   */

  /**
   * @typedef Zaehlwerk
   * @property {string} obisCode.required - obisCode - 1-1:1.9.0
   * @property {string} einheit.required - Einheit - WH
   * @property {Array.<Messwerte>} messwerte.required - Messwerte
   */

  /**
   * @typedef Messwerte
   * @property {int} messwert.required - Messert - 95
   * @property {string} zeitVon.required - Start of periode, ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} ZeitBis.required - End of periode, ISO timestamp - eg: 2023-12-31T15:14:59.999Z
   * @property {string} qualitaet.required - Qualität - eg: VAL
   */

  /**
   * @typedef ServerError
   * @property {string} error.required - Error descritpion
   */

  const getDateString = (val) =>
    String(val).toLowerCase() === "yesterday" ||
    String(val).toLowerCase() === "{date}" ||
    String(val).toLowerCase() === "undefined" ||
    val === undefined ||
    val === null
      ? undefined // fix for swagger
      : String(val || "").slice(0, 10) || undefined;

  const isTrue = (val) => val === true || String(val).toLowerCase() === "true";

  /**
   * Get raw measurment data for a date period.<br/><br/>Max. periode duration = 3 years.<br/>Default range = yesterday/yesterday
   * @route GET /meter/raw
   * @group Meter
   * @summary Retrieve raw measurements
   * @param {string} [id.query] - Meter ID (Zählpunkt), default: first meter in list - e.g. AT0010000000000000001xxxxxxxxxxxx
   * @param {string} [from.query] - Periode start (YYYY-MM-DD). (default: yesterday) - e.g. 2023-01-01
   * @param {string} [to.query] - Periode end (YYYY-MM-DD). (default: yesterday) - e.g. 2023-12-31
   * @produces application/json
   * @returns {Raw.model} 200 - Measurement data
   * @returns {ServerError.model} 500 - Server error
   */

  router.get("/meter/raw", async (request, response) => {
    try {
      const from = getDateString(request.query?.from);
      const to = getDateString(request.query?.to);
      const id = request.query?.id;

      logger.verbose("[API] GET /meter/raw", id, from, to);
      const data = await meter.getRawMeasurements({ id, from, to });
      response.status(200).json(data);
    } catch (error) {
      logger.error("[API] /meter/raw", error);
      response.status(500).json({ error });
    }
  });

  /**
   * Get measurment data for storage for a date period.<br/>Optionally store it to database.<br/><br/> Max. periode duration = 3 years.<br/> Default range = yesterday/yesterday
   * @route GET /meter/measurements
   * @group Meter
   * @summary Retrieve measurements for DB storage
   * @param {string} [id.query] - Meter ID (Zählpunkt), default: first meter in list - e.g. AT0010000000000000001xxxxxxxxxxxx
   * @param {string} [from.query] - Periode start (YYYY-MM-DD). (default: yesterday) - e.g. 2023-01-01
   * @param {string} [to.query] - Periode end (YYYY-MM-DD). (default: yesterday) - e.g. 2023-12-31
   * @param {boolean} [store.query = false] - Define if the retrieved data should be stored in the database. (default: false) - eg: false, true
   * @produces application/json
   * @returns {Array.<Measurement>} 200 - Measurement data
   * @returns {ServerError.model} 500 - Server error
   */

  router.get("/meter/measurements", async (request, response) => {
    try {
      const from = getDateString(request.query?.from);
      const to = getDateString(request.query?.to);
      const id = request.query?.id;

      logger.verbose(
        "[API] GET /meter/measurements",
        id,
        from,
        to,
        request?.query?.store
      );
      const data = await meter.getMeasurements({ id, from, to });
      const success = isTrue(request?.query?.store) ? store(data) : true;
      response.status(success ? 200 : 500).json(data);
    } catch (error) {
      logger.error("[API] /meter/measurements", error);
      response.status(500).json({ error });
    }
  });

  /**
   * Get consumption measurment data for a date period.<br/>Max. periode duration = 3 years.<br/>Default range = yesterday/yesterday
   * @route GET /meter/consumption
   * @group Meter
   * @summary Retrieve enhanced load measurements
   * @param {string} [id.query] - Meter ID (Zählpunkt), default: first meter in list - e.g. AT0010000000000000001xxxxxxxxxxxx
   * @param {string} [from.query] - Periode start (YYYY-MM-DD). (default: yesterday) - e.g. 2023-01-01
   * @param {string} [to.query] - Periode end (YYYY-MM-DD). (default: yesterday) - e.g. 2023-12-31
   * @param {enum} [aggregation.query = 15m] - aggregation level of data - eg: 15m,1h,1d,total
   * @produces application/json
   * @returns {Array.<EnhancedMeasurement>} 200 - Measurement data
   * @returns {ServerError.model} 500 - Server error
   */

  router.get("/meter/consumption", async (request, response) => {
    try {
      const from = getDateString(request.query?.from);
      const to = getDateString(request.query?.to);
      const id = request.query?.id;

      logger.verbose(
        "[API] GET /meter/consumption",
        id,
        from,
        to,
        request?.query?.aggregation
      );

      let data = [];
      switch (String(request?.query?.aggregation).toLowerCase()) {
        case "1h":
        case "hour":
        case "hourly":
          data = await meter.getConsumption1h({ id, from, to });
          break;
        case "1d":
        case "day":
        case "daily":
          data = await meter.getConsumption1d({ id, from, to });
          break;
        case "total":
        case "all":
          data = await meter.getConsumptionTotal({ id, from, to });
          break;
        case "15min":
        default:
          data = await meter.getConsumption({ id, from, to });
          break;
      }

      response.status(200).json(data);
    } catch (error) {
      logger.error("[API] /meter/consumption", error);
      response.status(500).json({ error });
    }
  });

  /**
   * Get load measurment data (15min interval) for a date period.<br/>Max. periode duration = 3 years.<br/>Default range = yesterday/yesterday
   * @route GET /meter/load
   * @group Meter
   * @summary Retrieve enhanced load measurements
   * @param {string} [id.query] - Meter ID (Zählpunkt), default: first meter in list - e.g. AT0010000000000000001xxxxxxxxxxxx
   * @param {string} [from.query] - Periode start (YYYY-MM-DD). (default: yesterday) - e.g. 2023-01-01
   * @param {string} [to.query] - Periode end (YYYY-MM-DD). (default: yesterday) - e.g. 2023-12-31
   * @produces application/json
   * @returns {Array.<EnhancedMeasurement>} 200 - Measurement data
   * @returns {ServerError.model} 500 - Server error
   */

  router.get("/meter/load", async (request, response) => {
    try {
      const from = getDateString(request.query?.from);
      const to = getDateString(request.query?.to);
      const id = request.query?.id;

      logger.verbose("[API] GET /meter/load", id, from, to);
      const data = await meter.getLoad({ id, from, to });
      response.status(200).json(data);
    } catch (error) {
      logger.error("[API] /meter/load", error);
      response.status(500).json({ error });
    }
  });

  return router;
};
