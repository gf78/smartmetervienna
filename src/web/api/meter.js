const express = require("express");

module.exports = function ({
  logger,
  send,
  store: execStore,
  getDay,
  getPeriod,
}) {
  const router = express.Router();

  /*
   *========== RAW B2C (Day) =================
   */
  /**
   * @typedef RawDayPoint
   * @property {int} value.required - Measured value - eg: 1234
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {boolean} isEstimated.required - Indication of value is estimated or final - eg: false, true
   */

  /**
   * @typedef RawDayStatistics
   * @property {int} maximum.required - Measured maximum value - eg: 999
   * @property {int} minimum.required - Measured minimum value - eg: 333
   * @property {int} average.required - Measured average value - eg: 666
   */

  /**
   * @typedef RawDay
   * @property {boolean} quarter-hour-opt-in.required - Status of opt-in - eg: false, true
   * @property {Array.<RawDayPoint>} values.required - Measured values
   * @property {RawDayStatistics.model} statistics.required - min, max, avg values
   */

  /*
   *========== RAW B2B (Range) =================
   */

  /**
   * @typedef RawPeriodMesswerte
   * @property {int} messert.required - Messert - 95
   * @property {string} zeitVon.required - Start of periode, ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} ZeitBis.required - End of periode, ISO timestamp - eg: 2023-12-31T15:14:59.999Z
   * @property {string} qualitaet.required - Qualität - eg: VAL
   */

  /**
   * @typedef RawPeriodZaehlwerk
   * @property {string} obisCode.required - obisCode - 1-1:1.9.0
   * @property {string} einheit.required - Einheit - WH
   * @property {Array.<RawPeriodMesswerte>} messwerte.required - Messwerte
   */

  /**
   * @typedef RawPeriodZaehlpunkt
   * @property {Array.<RawPeriodZaehlwerk>} zaehlwerke.required - Zählwerke
   * @property {string} zuaehlpunkt.required - Zählpunkt - AT0010000000000000001xxxxxxxxxxxx
   */

  /**
   * @typedef RawPeriod
   * @property {Array.<RawPeriodZaehlpunkt>} zaehlpunkte.required - Zählwerke
   */

  /*
   *========== OWN FORMAT =================
   */

  /**
   * @typedef Point
   * @property {enum} measurement.required - Type of measurement - eg: Consumption,Load_Avg
   * @property {enum} unit.required - Unit of value - eg: Wh,kWh,W
   * @property {int} value.required - Measured value - eg: 1234
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} start.required - Start of periode, ISO timestamp - eg: 2023-12-31T15:00:00.000Z
   * @property {string} end.required - End of periode, ISO timestamp - eg: 2023-12-31T15:14:59.999Z
   * @property {string} text.required  - Value as formated text - eg: 1.2kWh
   */

  /**
   * @typedef Load
   * @property {Array.<Point>} quarterHours.required - Measured load in 15min interval
   */

  /**
   * @typedef Consumption
   * @property {Array.<Point>} quarterHours.required - Measured consumption in 15min interval
   * @property {Array.<Point>} hours.required - Measured consumption in 1h intervals
   * @property {Array.<Point>} days.required - Measured consumption in 1d intervals
   * @property {Point.model} total.required - Total measured consumption
   */

  /**
   * @typedef Day
   * @property {string} meter.required - ID of smartmeter - eg: AT0010000000000000001xxxxxxxxxxxx
   * @property {string} retrieved.required - Day when data was retrieved, ISO timestamp - eg: 2023-12-02T08:00:01.700Z
   * @property {string} measured - Day of measurement, ISO timestamp (only available for day endpoint) - eg: 2023-12-01T22:00:00.000Z
   * @property {boolean} valid - True, if data is correct and not estimated  (only available for day endpoint) - eg: false, true
   * @property {RawDay.model} raw.required - Raw data received (differs for day and peripd endpoints)
   * @property {Consumption.model} consumption.required - consumption in Wh
   * @property {Load.model} load.required - average load in W
   */

  /**
   * @typedef Period
   * @property {string} meter.required - ID of smartmeter - eg: AT0010000000000000001xxxxxxxxxxxx
   * @property {string} retrieved.required - Day when data was retrieved, ISO timestamp - eg: 2023-12-02T08:00:01.700Z
   * @property {string} measured - Day of measurement, ISO timestamp (only available for day endpoint) - eg: 2023-12-01T22:00:00.000Z
   * @property {boolean} valid - True, if data is correct and not estimated  (only available for day endpoint) - eg: false, true
   * @property {RawPeriod.model} raw.required - Raw data received (differs for day and peripd endpoints)
   * @property {Consumption.model} consumption.required - consumption in Wh
   * @property {Load.model} load.required - average load in W
   */

  /**
   * @typedef Log
   * @property {Array.<LogEntry>} log.required - severity level - eg: error, debug, warn, data, info, verbose, silly
   */

  const getDateString = (val) =>
    String(val).toLowerCase() === "yesterday" ||
    String(val).toLowerCase() === "{date}" ||
    String(val).toLowerCase() === "undefined" ||
    val === undefined ||
    val === null
      ? undefined // fix for swagger
      : String(val || "").slice(0, 10) || undefined;

  const getScope = (
    { data = {}, scope = "full" } = { data: {}, scope: "full" }
  ) => {
    switch (String(scope || "full").toLowerCase()) {
      case "raw":
        return data?.raw || {};
      case "consumption":
        return data?.consumption || [];
      case "load":
        return data?.load?.quarterHours || [];
      case "quarterHours":
        return data?.consumption?.quarterHours || [];
      case "hours":
        return data?.consumption?.hours || [];
      case "days":
        return data?.consumption?.days || [];
      case "total":
        return data?.consumption?.total || {};
      case "full":
      default:
        return data || {};
    }
  };

  const storeAndNotify = (
    { data = {}, store = false, notify = false } = {
      data: {},
      store: false,
      notify: false,
    }
  ) => {
    if (!!data && (store === true || String(store).toLowerCase() === "true")) {
      return execStore(
        data,
        notify === true || String(notify).toLowerCase() === "true"
          ? true
          : false
      );
    } else {
      return false;
    }
  };

  /**
   * Get measurement data of a single day. Default date = yesterday.
   * @route GET /meter/day/{date}
   * @group METER
   * @param {string} [date.path] - Date of the measurement (YYYY-MM-DD). (default: yesterday) - e.g. 2023-12-31
   * @param {enum} [scope.query = full] - Scope of response - eg: full,raw,consumption,load,quarterHours,hours,days,total
   * @param {boolean} [store.query = false] - Define if the retrieved date should be stored in the database. (default: false) - eg: false, true
   * @param {boolean} [notify.query = false] - Define if notifications (webhook, email) should be sent after a store attempt to the database. (default: false) - eg: false, true
   * @param {enum} [format.query = json] - Format of the resonse (default: json) - eg: json,html
   * @produces application/json application/xhtml+xml
   * @returns {Day.model} Measurement data
   */

  router.get("/meter/day/:date?", async (request, response) => {
    try {
      const date = getDateString(request.params?.date);

      logger.verbose("[API] GET /meter/day/:date?", date);
      const data = await getDay(date);

      const responseData = getScope({ data, scope: request.query?.scope });
      send({ request, response, data: responseData });
      storeAndNotify({
        data,
        store: request.query?.store,
        notify: request.query?.notify,
      });
    } catch (error) {
      logger.error("[API] /meter/:date", error);
      response.status(500).json({ error });
    }
  });

  /**
   * Get measurments of a date period. Max. periode duration = 3 years. Default range = yesterday/yesterday
   * @route GET /meter/period
   * @group METER
   * @param {string} [from.query] - Periode start (YYYY-MM-DD). (default: yesterday) - e.g. 2023-01-01
   * @param {string} [to.query] - Periode end (YYYY-MM-DD). (default: yesterday) - e.g. 2023-12-31
   * @param {enum} [scope.query = full] - Scope of response - eg: full,raw,consumption,load,quarterHours,hours,days,total
   * @param {boolean} [store.query = false] - Define if the retrieved date should be stored in the database. (default: false) - eg: false, true
   * @param {boolean} [notify.query = false] - Define if notifications (webhook, email) should be sent after a store attempt to the database. (default: false) - eg: false, true
   * @param {enum} [format.query = json] - Format of the resonse (default: json) - eg: json,html
   * @produces application/json application/xhtml+xml
   * @returns {Period.model} Measurement data
   */

  router.get("/meter/period", async (request, response) => {
    try {
      const from = getDateString(request.query?.from);
      const to = getDateString(request.query?.to);

      logger.verbose("[API] GET /meter/period", from, to);
      const data = await getPeriod({ from, to });

      const responseData = getScope({
        data,
        scope: request.query?.scope,
      });
      send({ request, response, data: structuredClone(responseData) });
      storeAndNotify({
        data,
        store: request.query?.store,
        notify: request.query?.notify,
      });
    } catch (error) {
      logger.error("[API] /meter/period", error);
      response.status(500).json({ error });
    }
  });

  return router;
};
