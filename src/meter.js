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

  #formatData = ({ measurements, meterId, lastModified }) => {
    return measurements.map((measurement) => {
      const data = {
        isValid: true,
        error: null,
        meter: meterId,
        unit: "Wh",
        measurement: "consumption",
        consumptionUnit: "Wh",
        loadUnit: "W",
        value: null,
        consumption: null,
        load: null,
        timestamp: null,
        periodStart: null,
        periodEnd: null,
        raw: measurement,
        lastModified,
      };

      if (
        typeof measurement === "object" &&
        !!measurement?.value &&
        !!measurement?.timestamp &&
        !measurement?.isEstimated
      ) {
        const value = Number.parseInt(measurement?.value);

        if (Number.isNaN(value)) {
          data.isValid = false;
          data.error = "Value is not a number";
          return data;
        } else {
          data.value = value;
          data.consumption = value;
          data.load = value * 4;
        }

        const timestamp = new Date(measurement.timestamp);
        if (Number.isNaN(timestamp)) {
          data.isValid = false;
          data.error = "Invalid timestamp";
          return data;
        } else {
          data.timestamp = timestamp;
          data.periodStart = timestamp;
          data.periodEnd = new Date(timestamp.getTime() + 899999);
        }

        return data;
      } else {
        data.isValid = false;
        data.error = "Invalid format or extimated";
        return data;
      }
    });
  };

  getWattage = async (date = null) => {
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
        return this.#formatData({
          measurements: data.values,
          meterId,
          lastModified: new Date(),
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
}

module.exports = Meter;
