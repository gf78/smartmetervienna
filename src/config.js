"use strict";
const dotenv = require("dotenv");
const packagejson = require("../package.json");

const getFullConfig = () => {
  dotenv.config();

  return {
    service: {
      name: packagejson?.name,
      version: packagejson?.version,
      description: packagejson?.description,
      homepage: packagejson?.homepage,
      author: packagejson?.author,
    },
    logger: {
      level: process.env.LOG_LEVEL || "error",
    },
    meter: {
      username: process.env.LOGWIEN_USERNAME || null,
      password: process.env.LOGWIEN_PASSWORD || null,
      id: process.env.METER_ID || null,
      customer: process.env.CUSTOMER_ID || null,
    },
    db: {
      url: process.env.INLUXDB_URL || null,
      token: process.env.INLUXDB_TOKEN || null,
      organisation: process.env.INLUXDB_ORGANISATION || null,
      bucket: process.env.INLUXDB_BUCKET || "smartmetervienna",
      measurement: process.env.INLUXDB_MEASUREMENT || "Consumption_15min_Wh",
    },
    mailer: {
      enabled:
        process.env.MAIL_ENABLED === true ||
        String(process.env.MAIL_ENABLED).toLowerCase() === "true"
          ? true
          : false,
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null,
      secure:
        process.env.SMTP_SECURE === true ||
        String(process.env.SMTP_SECURE).toLowerCase() === "true"
          ? true
          : false,
      ciphers: process.env.SMTP_CIPHERS || null,
      username: process.env.SMTP_USERNAME || null,
      password: process.env.SMTP_PASSWORD || null,
      from: process.env.SMTP_FROM || "SmartMeter Vienna",
      to: process.env.MAIL_TO || null,
      subject: process.env.MAIL_SUBJECT || "SmartMeter Vienna",
      onRestart:
        process.env.MAIL_ON_RESTART === true ||
        String(process.env.MAIL_ON_RESTART).toLowerCase() === "false"
          ? false
          : true,
      onSuccess:
        process.env.MAIL_ON_SUCCESS === true ||
        String(process.env.MAIL_ON_SUCCESS).toLowerCase() === "false"
          ? false
          : true,
      onError:
        process.env.MAIL_ON_FAILURE === true ||
        String(process.env.MAIL_ON_FAILURE).toLowerCase() === "false"
          ? false
          : true,
    },
    webhook: {
      enabled:
        process.env.WEBHOOK_ENABLED === true ||
        String(process.env.WEBHOOK_ENABLED).toLowerCase() === "true"
          ? true
          : false,
      method: process.env.WEBHOOK_METHOD || "POST",
      urls: {
        restart: process.env.WEBHOOK_URL_RESTART || null,
        success: process.env.WEBHOOK_URL_SUCCESS || null,
        failure: process.env.WEBHOOK_URL_FAILURE || null,
      },
    },
    web: {
      port: !Number.isNaN(Number.parseInt(process.env.PORT))
        ? Number.parseInt(process.env.PORT) || 1978
        : 1978,
      apiPath: process.env.API_PATH || "/api/v1",
      apiKey: process.env.API_KEY || null,
    },
    cron: {
      schedule: process.env.CRON_SCHEDULE || null,
      days: Number.isNaN(Number.parseInt(process.env.CRON_DAYS_IN_PAST))
        ? Number.parseInt(process.env.PORT) || 7
        : 7,
    },
    system: {
      environment: process.env.NODE_ENV || null,
      systemStart: new Date(),
    },
  };
};

const getFilterConfig = (config) => {
  const filteredConfig = {};

  for (const [groupKey, groupValue] of Object.entries(
    config || getFullConfig()
  )) {
    filteredConfig[groupKey] = {};
    for (const [settingsKey, settingsValue] of Object.entries(groupValue)) {
      if (
        String(settingsKey || "")
          .toLowerCase()
          .indexOf("key") === -1 &&
        String(settingsKey || "")
          .toLowerCase()
          .indexOf("pass") === -1 &&
        String(settingsKey || "")
          .toLowerCase()
          .indexOf("token") === -1
      ) {
        filteredConfig[groupKey][settingsKey] = settingsValue;
      } else {
        filteredConfig[groupKey][settingsKey] = "***";
      }
    }
  }

  return filteredConfig;
};

const getConfig = () => {
  const config = getFullConfig();
  return { ...config, _filtered: getFilterConfig(config) };
};

module.exports = getConfig;
