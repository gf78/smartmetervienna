"use strict";

const cron = require("node-cron");

const getConfig = require("./src/config.js");
const Meter = require("./src/meter.js");
const DB = require("./src/db.js");
const Web = require("./src/web.js");
const Mailer = require("./src/mailer.js");
const Webhook = require("./src/webhook.js");
const Logger = require("./src/logger.js");

const config = getConfig();
const logger = new Logger(config.logger);

try {
  const main = async () => {
    // SmartMeter Connector
    const meter = new Meter({
      ...config.meter,
      logger,
    });

    // Influx DB2 Connector
    const db = new DB({
      ...config.db,
      logger,
    });

    // SMTP Notifier
    const mailer = new Mailer({
      ...config.mailer,
      logger,
    });

    // Webhook Notifier
    const webhook = new Webhook({
      ...config.webhook,
      logger,
    });

    // Webhook: Success/Failure notification
    const notifyViaWebhook = ({ success, data }) => {
      try {
        logger.verbose("[NOTIFY WEBHOOK] Notify via webhook ...");
        webhook.send({ cmd: success ? "success" : "failure", data });
      } catch (error) {
        logger.error("[NOTIFY WEBHOOK] Webhook could not be sent.", error);
      }
      return success;
    };

    // E-Mail: Success/Failure notification
    const notifyViaEmail = ({ success, data }) => {
      try {
        logger.verbose("[NOTIFY EMAIL] Notify via email ...");
        if (success && config.mailer.onSuccess) {
          mailer.send({
            text:
              "[OK] Messdaten wurden in Datenbank gespeichert.\n\n\n\n\n" +
              JSON.stringify(data, null, "\t"),
          });
        } else if (!success && config.mailer.onError) {
          mailer.send({
            text: "[FEHLER] Messdaten konnten nicht in Datenbank gespeichert werden.",
          });
        }
      } catch (error) {
        logger.error("[NOTIFY EMAIL] Email could not be sent.", error);
      }
      return success;
    };

    // Store measurements to database and opt. notify
    const store = async (data, notify = false) => {
      logger.verbose("[STOREDATA] Storing data...");
      let success = false;
      try {
        if (
          typeof data === "object" &&
          Array.isArray(data) &&
          data.length > 0
        ) {
          success = await db.write(data);
          if (success) {
            logger.info("[STOREDATA] Data stored successfully");
          } else {
            logger.error("[STOREDATA] Data could not be stored");
          }
        }
      } catch (error) {
        logger.error("[STOREDATA] Data could not be stored.", error);
      }

      if (notify) {
        notifyViaWebhook({ success, data });
        notifyViaEmail({ success, data });
      }
      return success;
    };

    // Web UI + REST API
    const web = new Web({ ...config.web, meter, logger, store, config });

    // Schedule Cron Job
    if (typeof config.cron.schedule === "string") {
      cron.schedule(config.cron.schedule, async () => {
        try {
          const data = await meter.getWattage();
          store(data, true);
        } catch (error) {
          logger.error("[CRON] Error", error);
        }
      });
    }

    // Notify about restart
    webhook.send({ cmd: "restart" });
    if (config.mailer.onRestart === "true") {
      mailer.send({
        text: "[INFO] Service wurde gestartet.",
      });
    }
  };

  main();
} catch (error) {
  logger.error("[GENERAL] Unkown Error", error);
}
