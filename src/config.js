"use strict";
const dotenv = require("dotenv");

const getConfig = () => {
  dotenv.config();
  return {
    logger: {
      level: process.env.LOG_LEVEL || "error",
    },
    meter: {
      username: process.env.LOGWIEN_USERNAME || null,
      password: process.env.LOGWIEN_PASSWORD || null,
      meterId: process.env.METER_ID || null,
    },
    db: {
      url: process.env.INLUXDB_URL || null,
      token: process.env.INLUXDB_TOKEN || null,
      organisation: process.env.INLUXDB_ORGANISATION || null,
      bucket: process.env.INLUXDB_BUCKET || null,
      measurement: process.env.INLUXDB_MEASUREMENT || "Wattage_15min_Wh",
    },
    mailer: {
      enabled: process.env.MAIL_ENABLED === "true" ? true : false,
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null,
      secure: process.env.SMTP_SECURE === "true" ? true : false,
      ciphers: process.env.SMTP_CIPHERS || null,
      username: process.env.SMTP_USERNAME || null,
      password: process.env.SMTP_PASSWORD || null,
      from: process.env.SMTP_FROM || "SmartMeter Vienna",
      to: process.env.MAIL_TO || null,
      subject: process.env.MAIL_SUBJECT || "SmartMeter Vienna",
      onRestart: process.env.MAIL_ON_RESTART === "false" ? false : true,
      onSuccess: process.env.MAIL_ON_SUCCESS === "false" ? false : true,
      onError: process.env.MAIL_ON_FAILURE === "false" ? false : true,
    },
    webhook: {
      enabled: process.env.WEBHOOK_ENABLED === "true" ? true : false,
      method: process.env.WEBHOOK_METHOD || "POST",
      urls: {
        restart: process.env.WEBHOOK_URL_RESTART || null,
        success: process.env.WEBHOOK_URL_SUCCESS || null,
        failure: process.env.WEBHOOK_URL_FAILURE || null,
      },
    },
    web: { port: process.env.PORT || 1978 },
    cron: {
      schedule: process.env.CRON_SCHEDULE || null,
    },
    system: {
      environment: process.env.NODE_ENV || null,
      systemStart: new Date(),
    },
  };
};

module.exports = getConfig;