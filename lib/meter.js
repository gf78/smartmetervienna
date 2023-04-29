"use strict";

const startOfYesterday = require("date-fns/startOfYesterday");
const startOfDay = require("date-fns/startOfDay");

const LogWien = require("./logwien.js");
const Logger = require("./logger.js");

const BASE_URL =
  "https://api.wstw.at/gateway/WN_SMART_METER_PORTAL_API_B2C/1.0/";
const API_KEY = "afb0be74-6455-44f5-a34d-6994223020ba";
const CLIENT_ID = "wn-smartmeter";
const REDIRECT_URI = "https://www.wienernetze.at/wnapp/smapp/";

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

  #call = async (endpoint, params = null) => {
    this.#logger.verbose("[METER] Call endpoint", endpoint, params);
    try {
      const response = await this.#fetch(
        BASE_URL +
          endpoint +
          (typeof params === "object" ? "?" + new URLSearchParams(params) : ""),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Gateway-APIKey": API_KEY,
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

  getMeters = () => this.#call("zaehlpunkte");

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

  #isDataValid = (data) => {
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

  #getQuarterHourConsumption = (measurements, meter) =>
    (measurements || []).map(({ value, timestamp }) => ({
      meter,
      measurement: "Consumption",
      unit: "Wh",
      value: Number.parseInt(value),
      timestamp: new Date(timestamp),
      start: new Date(timestamp),
      end: new Date(new Date(timestamp).getTime() + 899999),
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
      });
    });
    return arr || [];
  };

  #getDayConsumption = (consumption) => {
    const value = (consumption || []).reduce(
      (total, measurement) => total + measurement.value,
      0
    );

    const text = `${Math.round((value || 0) / 100) / 10}k${
      consumption[0].unit
    }`;

    return [
      {
        meter: consumption[0].meter,
        measurement: consumption[0].measurement,
        unit: consumption[0].unit,
        value,
        timestamp: consumption[0].timestamp,
        start: consumption[0].start,
        end: new Date(consumption[0].start.getTime() + 86399999),
        text,
      },
    ];
  };

  #processData = (raw, measured, meter) => {
    this.#logger.verbose("[METER] Processing data ... ");

    const data = {
      meter,
      measured,
      retrieved: new Date(),
      valid: false,
      raw,
      quarterHours: {
        consumption: [],
        load: [],
      },
      hours: {
        consumption: [],
      },
      day: {
        consumption: null,
      },
    };
    try {
      data.valid = this.#isDataValid(raw);
      if (data.valid) {
        data.quarterHours.consumption = this.#getQuarterHourConsumption(
          raw.values
        );
        data.quarterHours.load = this.#getQuarterHourLoadAvg(raw.values);
        data.hours.consumption = this.#getHourConsumption(
          data.quarterHours.consumption
        );
        data.day.consumption = this.#getDayConsumption(data.hours.consumption);
      }
    } catch (error) {
      this.#logger.error("[METER] Data processing error", error);
    }
    return data;
  };

  getData = async (date = null) => {
    try {
      const meterId = await this.getMeterId();

      const dateFrom = new Date(
        date ? startOfDay(new Date(date)) : startOfYesterday()
      ).toISOString();

      if (meterId && dateFrom) {
        const data = await this.#call(
          `messdaten/zaehlpunkt/${meterId}/verbrauch`,
          {
            dateFrom,
            period: "DAY",
            accumulate: false,
            offset: 0,
            dayViewResolution: "QUARTER-HOUR",
          }
        );

        return this.#processData(data, dateFrom, meterId);
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
}

module.exports = Meter;
