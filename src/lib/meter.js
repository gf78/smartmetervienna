"use strict";

const startOfDay = require("date-fns/startOfDay");
const endOfDay = require("date-fns/endOfDay");
const isValidDate = require("date-fns/isValid");
const objectPath = require("object-path");

const LogWien = require("./logwien.js");
const Logger = require("./logger.js");
const date = require("./date.js");

const B2B = {
  portal: "B2B",
  clientId: "wn-smartmeter-b2b",
  redirectUri: "https://smartmeter-business.wienernetze.at/",
  baseUrl: "https://api.wstw.at/gateway/WN_SMART_METER_PORTAL_API_B2B/1.0/",
  apiKey: "93d5d520-7cc8-11eb-99bc-ba811041b5f6",
  meters: {
    url: "zaehlpunkte?resultType=ALL&loadIdexValues=true&contractActive=true",
    objPath: "0.zaehlpunktnummer",
  },
  measurements: {
    url: "zaehlpunkte/messwerte",
    params: {
      id: "zaehlpunkt",
      from: "datumVon",
      to: "datumBis",
      other: {
        wertetyp: "QUARTER_HOUR",
      },
    },
    isoDate: false,
    objPath: "0.zaehlwerke.0.messwerte",
    value: "messwert",
    timestamp: "zeitVon",
  },
};

class Meter {
  #id;
  #config;
  #fetch;
  #logger;

  constructor(
    { username, password, id, logger = new Logger(), config = B2B } = {
      config: B2B,
      logger: new Logger(),
    }
  ) {
    try {
      this.#id = typeof id === "string" ? id : null;
      this.#config = config;
      this.#logger = typeof logger === "object" ? logger : new Logger();
      const logwien = new LogWien({
        username,
        password,
        clientId: config?.clientId,
        redirectUri: config?.redirectUri,
        logger: this.#logger,
      });

      this.#fetch = logwien.fetch;
    } catch (error) {
      this.#logger.error("[METER] Could not create instance.");
    }
  }

  #curl = async (
    { url = "", params = null } = {
      url: "",
      params: null,
    }
  ) => {
    this.#logger.verbose("[METER] Call endpoint", url, params);
    try {
      const response = await this.#fetch(
        this.#config.baseUrl +
          url +
          (typeof params === "object" ? "?" + new URLSearchParams(params) : ""),
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Gateway-APIKey": this.#config.apiKey,
          },
        }
      );
      return await response.json();
    } catch (error) {
      this.#logger.error("[METER] Call fetch API error", error, url, params);
    }
    return false;
  };

  getId = async () => {
    if (!this.#id) {
      this.#id = await this.#getDefaultId();
    }
    return this.#id;
  };

  #getDefaultId = async () => {
    try {
      this.#logger.verbose("[METER] Get ID of default meter ...");
      const meters = await this.#curl({ url: this.#config.meters.url });
      this.#id = objectPath.get(meters, this.#config.meters.objPath);
    } catch (error) {
      this.#logger.error(
        "[METER] Could not retrieve ID of default meter.",
        error
      );
      this.#id = null;
    }
    return this.#id;
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

  #formatConsumption = (measurements, meter) =>
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

  #formatLoad = (measurements, meter) =>
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

  #aggregateByHour = (consumption) => {
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

  #aggregateByDay = (consumption) => {
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

  #aggregateTotal = (consumption) => {
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

  #parseDateParam = (val) => {
    const strVal = String(val || "").slice(0, 10);
    if (strVal.length === 10 && isValidDate(new Date(strVal))) {
      return strVal;
    } else {
      return date.getDateString();
    }
  };

  #parseMeasurements = (raw) => {
    this.#logger.verbose("[METER] Parsing measurement data...");
    try {
      const rawValues = objectPath.get(raw, this.#config.measurements.objPath);

      if (Array.isArray(rawValues)) {
        const measurements = [];

        rawValues.forEach((rawValue) => {
          try {
            const measurement = {
              value: Number.parseInt(rawValue[this.#config.measurements.value]),
              timestamp: new Date(
                rawValue[this.#config.measurements.timestamp]
              ),
            };

            if (
              !Number.isNaN(measurement.value) &&
              isValidDate(measurement.timestamp)
            ) {
              measurements.push(measurement);
            } else {
              this.#logger.debug(
                "[METER] Invalid measurement value",
                measurement
              );
            }
          } catch (error) {
            this.#logger.debug(
              "[METER] Could not parse value",
              error,
              rawValue
            );
          }
        });
        return measurements;
      } else {
        this.#logger.debug(
          "[METER] Invalid measurementdata. Could not be parsed."
        );
        return [];
      }
    } catch (error) {
      this.#logger.error("[METER] Error parsing measurement data.", error);
      return [];
    }
  };

  getRawMeasurements = async ({ id, from, to } = {}) => {
    this.#logger.verbose("[METER] Get raw measurments");
    try {
      const valId = id ? id : await this.getId();
      let valFrom = this.#parseDateParam(from);
      let valTo = this.#parseDateParam(to || from);

      if (this.#config?.measurements?.isoDate) {
        valFrom = startOfDay(new Date(valFrom)).toISOString();
        valTo = endOfDay(new Date(valTo)).toISOString();
      }

      const url = String(this.#config?.measurements?.url || "")
        .replaceAll("%ID%", valId)
        .replaceAll("%FROM%", valFrom)
        .replaceAll("%TO", valTo);

      if (!!valId && !!valFrom && !!valTo) {
        return await this.#curl({
          url,
          params: {
            [this.#config?.measurements?.params?.id || "id"]: valId,
            [this.#config?.measurements?.params?.from || "from"]: valFrom,
            [this.#config?.measurements?.params?.to || "to"]: valTo,
            ...this.#config?.measurements?.params?.other,
          },
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

  getMeasurements = async (...args) => {
    this.#logger.verbose("[METER] Get measurements");
    try {
      const raw = await this.getRawMeasurements(...args);
      return this.#parseMeasurements(raw);
    } catch (error) {
      this.#logger.error("[METER] Error get measurements", error);
      return [];
    }
  };

  getLoad = async (...args) => {
    this.#logger.verbose("[METER] Get load 15min");
    try {
      const measurements = await this.getMeasurements(...args);
      return this.#formatLoad(measurements);
    } catch (error) {
      this.#logger.error("[METER] Error get load 15min", error);
      return [];
    }
  };

  getConsumption = async (...args) => {
    this.#logger.verbose("[METER] Get consumption 15min");
    try {
      const measurements = await this.getMeasurements(...args);
      return this.#formatConsumption(measurements);
    } catch (error) {
      this.#logger.error("[METER] Error get consumption 15min", error);
      return [];
    }
  };

  getConsumption1h = async (...args) => {
    this.#logger.verbose("[METER] Get consumption 1h");
    try {
      const consumption = await this.getConsumption(...args);
      return this.#aggregateByHour(consumption);
    } catch (error) {
      this.#logger.error("[METER] Error get consumption 1h", error);
      return [];
    }
  };

  getConsumption1d = async (...args) => {
    this.#logger.verbose("[METER] Get consumption 1d");
    try {
      const consumption = await this.getConsumption(...args);
      return this.#aggregateByDay(consumption);
    } catch (error) {
      this.#logger.error("[METER] Error get consumption 1d", error);
      return [];
    }
  };

  getConsumptionTotal = async (...args) => {
    this.#logger.verbose("[METER] Get consumption total");
    try {
      const consumption = await this.getConsumption(...args);
      return this.#aggregateTotal(consumption);
    } catch (error) {
      this.#logger.error("[METER] Error get consumptiontotal", error);
      return [];
    }
  };
}

module.exports = Meter;
