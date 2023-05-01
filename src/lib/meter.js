"use strict";

const startOfYesterday = require("date-fns/startOfYesterday");
const startOfDay = require("date-fns/startOfDay");
const isValidDate = require("date-fns/isValid");

const LogWien = require("./logwien.js");
const Logger = require("./logger.js");
const { min } = require("date-fns");

const B2C_BASE_URL =
  "https://api.wstw.at/gateway/WN_SMART_METER_PORTAL_API_B2C/1.0/";
const B2C_API_KEY = "afb0be74-6455-44f5-a34d-6994223020ba";
const CLIENT_ID = "wn-smartmeter";
const REDIRECT_URI = "https://www.wienernetze.at/wnapp/smapp/";

const B2B_BASE_URL =
  "https://api.wstw.at/gateway/WN_SMART_METER_PORTAL_API_B2B/1.0/";
const B2B_API_KEY = "93d5d520-7cc8-11eb-99bc-ba811041b5f6";

//"https://api.wstw.at/gateway/WN_SMART_METER_PORTAL_API_B2B/1.0/zaehlpunkte/messwerte?zaehlpunkt=AT0010000000000000001000015076934&datumVon=2023-05-01&datumBis=2023-05-01&wertetyp=QUARTER_HOUR"

class Meter {
  #meterId;
  #fetch;
  #logger;

  constructor(
    { meterId, username, password, logger = new Logger() } = {
      logger: new Logger(),
    }
  ) {
    try {
      this.#meterId = typeof meterId === "string" ? meterId : null;
      this.#logger = typeof logger === "object" ? logger : new Logger();
      const logwien = new LogWien({
        username,
        password,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        logger: this.#logger,
      });

      this.#fetch = logwien.fetch;
    } catch (error) {
      this.#logger.error("[METER] Could not create instance.");
    }
  }

  #call = async (
    { endpoint = "", params = null, b2b = false } = {
      endpoint: "",
      params: null,
      b2b: false,
    }
  ) => {
    this.#logger.verbose("[METER] Call endpoint", endpoint, params);
    try {
      const response = await this.#fetch(
        (b2b ? B2B_BASE_URL : B2C_BASE_URL) +
          endpoint +
          (typeof params === "object" ? "?" + new URLSearchParams(params) : ""),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Gateway-APIKey": b2b ? B2B_API_KEY : B2C_API_KEY,
          },
        }
      );
      return await response.json();
    } catch (error) {
      this.#logger.error(
        "[METER] Call fetch API error",
        error,
        endpoint,
        params
      );
    }
    return false;
  };

  getMeterId = async () => {
    if (!this.#meterId) {
      this.#meterId = await this.getFirstMeterId();
    }
    return this.#meterId;
  };

  getMeters = () => this.#call({ endpoint: "zaehlpunkte" });

  getFirstMeterId = async () => {
    try {
      this.#logger.verbose("[METER] Get ID of first meter ...", this.#meterId);
      const meters = await this.getMeters();
      this.#meterId = meters[0].zaehlpunkte[0].zaehlpunktnummer;
    } catch (error) {
      this.#logger.error(
        "[METER] Could not retrieve ID of first meter.",
        error
      );
      this.#meterId = null;
    }
    return this.#meterId;
  };

  #isMeasurementValid = ({ value, timestamp, isEstimated } = {}) =>
    !(
      !value ||
      !timestamp ||
      !!isEstimated ||
      Number.isNaN(Number.parseInt(value)) ||
      Number.isNaN(new Date(timestamp))
    );

  #isDayDataValid = (data) => {
    try {
      this.#logger.verbose("[METER] Validating data ... ");
      if (
        typeof data === "object" &&
        Array.isArray(data?.values) &&
        data.values.length === 96
      ) {
        return !data.values.some(
          (measurement) => !this.#isMeasurementValid(measurement)
        );
      } else {
        return false;
      }
    } catch (error) {
      this.#logger.error("[METER] Error on data validation.");
      return false;
    }
  };

  #getTextValue = (value, unit = "") => {
    try {
      if (Number.isNaN(value)) {
        return "";
      }

      if (value >= 1000) {
        return `${Math.round((value || 0) / 100) / 10}k${unit}`;
      } else {
        return `${value}${unit}`;
      }
    } catch (error) {
      this.#logger.error(
        "[METER] Error on text value creation.",
        error,
        value,
        unit
      );
      return "";
    }
  };

  #getQuarterHourConsumption = (measurements, meter) =>
    (measurements || []).map(({ value, timestamp }) => ({
      meter,
      measurement: "Consumption",
      unit: "Wh",
      value: Number.parseInt(value),
      timestamp: new Date(timestamp),
      start: new Date(timestamp),
      end: new Date(new Date(timestamp).getTime() + 899999),
      text: this.#getTextValue(Number.parseInt(value), "Wh"),
    }));

  #getQuarterHourLoadAvg = (measurements, meter) =>
    (measurements || []).map(({ value, timestamp }) => ({
      meter,
      measurement: "Load_Avg",
      unit: "W",
      value: Number.parseInt(value) * 4,
      timestamp: new Date(timestamp),
      start: new Date(timestamp),
      end: new Date(new Date(timestamp).getTime() + 899999),
      text: this.#getTextValue(Number.parseInt(value) * 4, "W"),
    }));

  #getHourConsumption = (consumption) => {
    const obj = {};
    const arr = [];
    (consumption || []).forEach((quarterHour) => {
      const timestamp = `${quarterHour.timestamp
        .toISOString()
        .slice(0, 13)}:00:00.000Z`;
      obj[timestamp] = quarterHour.value + (obj[timestamp] || 0);
    });

    Object.entries(obj).forEach(([timestamp, value]) => {
      arr.push({
        meter: consumption[0].meter,
        measurement: consumption[0].measurement,
        unit: consumption[0].unit,
        value,
        timestamp: new Date(timestamp),
        start: new Date(timestamp),
        end: new Date(new Date(timestamp).getTime() + 3599999),
        text: this.#getTextValue(value, consumption[0].unit),
      });
    });
    return arr || [];
  };

  #getDayConsumption = (consumption) => {
    const obj = {};
    const arr = [];
    (consumption || []).forEach((measurement) => {
      const strDay = `${measurement.timestamp.getFullYear()}-${(
        "0" +
        (measurement.timestamp.getMonth() + 1)
      ).slice(-2)}-${("0" + measurement.timestamp.getDate()).slice(-2)}`;

      obj[strDay] = {
        value: measurement.value + (obj[strDay]?.value || 0),
        timestamp: obj[strDay]?.timestamp
          ? Math.min(measurement.timestamp, obj[strDay]?.timestamp)
          : measurement.timestamp,
      };
    });

    Object.entries(obj).forEach(([strDay, measurement]) => {
      arr.push({
        meter: consumption[0].meter,
        measurement: consumption[0].measurement,
        unit: consumption[0].unit,
        value: measurement.value,
        timestamp: new Date(measurement.timestamp),
        start: new Date(measurement.timestamp),
        end: new Date(new Date(measurement.timestamp).getTime() + 86399999),
        text: this.#getTextValue(measurement.value, consumption[0].unit),
      });
    });
    return arr || [];
  };

  #getTotalConsumption = (consumption) => {
    const value = (consumption || []).reduce(
      (total, measurement) => total + measurement.value,
      0
    );

    const start = new Date(
      (consumption || []).reduce(
        (total, measurement) => Math.min(measurement.timestamp),
        0
      )
    );

    const end = new Date(
      (consumption || []).reduce(
        (total, measurement) => Math.max(measurement.end),
        0
      )
    );

    return {
      meter: consumption[0].meter,
      measurement: consumption[0].measurement,
      unit: consumption[0].unit,
      value,
      timestamp: start,
      start,
      end,
      text: this.#getTextValue(value, consumption[0].unit),
    };
  };

  #processData = ({ raw, values, meter, ...rest }) => {
    this.#logger.verbose("[METER] Processing data ... ");

    const data = {
      meter,
      retrieved: new Date(),
      ...rest,
      raw,
      consumption: {
        quarterHours: [],
        hours: [],
        days: [],
        total: {},
      },
      load: {
        quarterHours: [],
      },
    };
    try {
      if (values) {
        data.consumption.quarterHours = this.#getQuarterHourConsumption(values);
        data.load.quarterHours = this.#getQuarterHourLoadAvg(values);
        data.consumption.hours = this.#getHourConsumption(
          data.consumption.quarterHours
        );
        data.consumption.days = this.#getDayConsumption(data.consumption.hours);
        data.consumption.total = this.#getTotalConsumption(
          data.consumption.days
        );
      }
    } catch (error) {
      this.#logger.error("[METER] Data processing error", error);
    }
    return data;
  };

  getDay = async (date = null) => {
    try {
      const meterId = await this.getMeterId();

      const dateFrom = new Date(
        date ? startOfDay(new Date(date)) : startOfYesterday()
      ).toISOString();

      if (meterId && dateFrom) {
        const raw = await this.#call({
          endpoint: `messdaten/zaehlpunkt/${meterId}/verbrauch`,
          params: {
            dateFrom,
            period: "DAY",
            accumulate: false,
            offset: 0,
            dayViewResolution: "QUARTER-HOUR",
          },
        });

        const isValid = this.#isDayDataValid(raw);
        return this.#processData({
          raw,
          measured: dateFrom,
          meter: meterId,
          isValid,
          values: isValid ? raw.values : [],
        });
      } else {
        this.#logger.error(
          "[METER] Missing meter or date to retrieve wattage."
        );
        return [];
      }
    } catch (error) {
      this.#logger.error("[METER] Could not retrieve wattage.", error);
      return [];
    }
  };

  #getPeriodDate = (val) => {
    const strVal = String(val || "").slice(0, 10);
    if (strVal.length === 10 && isValidDate(new Date(strVal))) {
      return strVal;
    } else {
      const yesterday = startOfYesterday();
      return `${yesterday.getFullYear()}-${(
        "0" +
        (yesterday.getMonth() + 1)
      ).slice(-2)}-${("0" + yesterday.getDate()).slice(-2)}`;
    }
  };

  #getMeasurementsB2B = (data) => {
    this.#logger.verbose("[METER] Parsing B2B data...");
    try {
      if (
        data &&
        Array.isArray(data) &&
        data.length > 0 &&
        Array.isArray(data[0].zaehlwerke) &&
        data[0].zaehlwerke.length > 0 &&
        Array.isArray(data[0].zaehlwerke[0].messwerte) &&
        data[0].zaehlwerke[0].messwerte.length > 0
      ) {
        return data[0].zaehlwerke[0].messwerte.map((measurement) => ({
          value: Number.parseInt(measurement.messwert),
          timestamp: new Date(measurement.zeitVon),
        }));
      } else {
        this.#logger.verbose("[METER] Empty or invalid B2B data.");
        return [];
      }
    } catch (error) {
      this.#logger.error("[METER] Could not parse B2B data format.");
      return [];
    }
  };

  getPeriod = async ({ from, to } = {}) => {
    try {
      const zaehlpunkt = await this.getMeterId();
      const datumVon = this.#getPeriodDate(from);
      const datumBis = this.#getPeriodDate(to);
      const wertetyp = "QUARTER_HOUR";

      if (!!zaehlpunkt && !!datumVon && !!datumBis && !!wertetyp) {
        const raw = await this.#call({
          endpoint: "zaehlpunkte/messwerte",
          params: {
            zaehlpunkt,
            datumVon,
            datumBis,
            wertetyp,
          },
          b2b: true,
        });

        return this.#processData({
          raw,
          meter: zaehlpunkt,
          values: this.#getMeasurementsB2B(raw),
        });
      } else {
        this.#logger.error("[METER] Missing meter or date to retrieve export.");
        return [];
      }
    } catch (error) {
      this.#logger.error("[METER] Could not retrieve export.", error);
      return [];
    }
  };
}

module.exports = Meter;
