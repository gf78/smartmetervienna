"use strict";
const fs = require("fs");
const Logger = require("./lib/logger.js");
const Meter = require("./lib/meter.js");
const DB = require("./lib/db.js");
const Cron = require("./lib/cron.js");
const Mailer = require("./lib/mailer.js");
const Webhook = require("./lib/webhook.js");

const getConfig = require("./config.js");
const Web = require("./web/index.js");

class Core {
  #config;
  #logger;
  #meter;
  #db;
  #mailer;
  #webhook;
  #web;
  #cron;

  constructor(...args) {
    this.#initialize(...args);
  }

  #initialize = () => {
    const _init = async () => {
      this.#config = getConfig() || {};
      this.#hello();

      this.#logger = new Logger(this.#config.logger);
      try {
        // SmartMeter Connector
        this.#meter = new Meter({
          ...this.#config?.meter,
          logger: this.#logger,
        });

        // Influx DB2 Connector
        this.#db = new DB({
          ...this.#config?.db,
          logger: this.#logger,
        });

        // SMTP Notifier
        this.#mailer = new Mailer({
          ...this.#config?.mailer,
          logger: this.#logger,
        });

        // Webhook Notifier
        this.#webhook = new Webhook({
          ...this.#config?.webhook,
          logger: this.#logger,
        });

        // Schedule Cron Job
        this.#cron = new Cron({
          schedule: this.#config?.cron?.schedule,
          task: this.#cronTask,
          logger: this.#logger,
        });

        // Web UI + REST API
        this.#web = new Web({
          ...this.#config?.web,
          getDay: this.#meter.getDay,
          getPeriod: this.#meter.getPeriod,
          logger: this.#logger,
          store: this.#store,
          config: this.#config,
        });

        // Notify on restart
        this.#webhook.send({ cmd: "restart" });
        if (this.#config?.mailer?.onRestart) {
          this.#mailer.send({
            text: "[INFO] Service wurde gestartet.",
          });
        }
      } catch (error) {
        this.#logger.error(`[CORE] Could not initialize instance.`, error);
      }
    };

    _init();
  };

  #hello = () => {
    const textLogo = fs.readFileSync("./media/logo.txt", "utf8");
    console.log(textLogo);
    console.log(
      `Version: ${this.#config?.service?.version || "unkown"}\r\n\r\n`
    );
  };

  get logger() {
    return this.#logger;
  }

  #notifyFormatter = (text, data) => {
    try {
      return String(text)
        .replaceAll("%%DAY%%", new Date(data?.measured).toLocaleDateString())
        .replaceAll("%%VALUE%%", data?.day?.consumption[0].text);
    } catch (error) {
      return text;
    }
  };

  // Webhook: Success/Failure notification
  #notifyWebhook = ({ success, data }) => {
    try {
      this.#logger.verbose("[CORE] Notify via webhook ...");

      if (success) {
        this.#webhook.send({
          cmd: this.#notifyFormatter(
            this.#config?.webhook?.urls?.success,
            data
          ),
          data,
        });
      } else {
        this.#webhook.send({ cmd: "failure", data });
      }
    } catch (error) {
      this.#logger.error("[CORE] Webhook could not be sent.", error);
    }
  };

  // E-Mail: Success/Failure notification
  #notifyEmail = ({ success, data }) => {
    try {
      this.#logger.verbose("[CORE Notify via email ...");
      if (success && this.#config.mailer.onSuccess) {
        this.#mailer.send({
          text: this.#notifyFormatter(
            "[OK] Messdaten wurden in Datenbank gespeichert.\n\nVerbrauch am %%DAY%%: %%VALUE%%",
            data
          ),
        });
      } else if (!success && this.#config.mailer.onError) {
        this.#mailer.send({
          text: "[FEHLER] Messdaten konnten nicht in Datenbank gespeichert werden.",
        });
      }
    } catch (error) {
      this.#logger.error("[CORE] Email could not be sent.", error);
    }
  };

  // Notify: Email and/or Webhook
  #notify = (
    { success = false, data = null } = { success: false, data: null }
  ) => {
    try {
      this.#notifyWebhook({ success, data });
      this.#notifyEmail({ success, data });
    } catch (error) {
      this.#logger.error("[CORE] Notify failed.", error);
    }
  };

  // DB: Store data (and notify)
  #store = async (data, notify = false) => {
    this.#logger.verbose("[CORE] Storing data to DB ...");
    let success = false;
    try {
      const storeData = data?.consumption?.quarterHours || [];
      if (Array.isArray(storeData) && storeData.length > 0) {
        success = await this.#db.write(storeData);
        if (success) {
          this.#logger.info("[CORE] Data stored successfully to DB.");
        } else {
          this.#logger.error("[CORE] Data could not be stored to DB.");
        }
      }
    } catch (error) {
      this.#logger.error("[CORE] Data could not be stored.", error);
    }

    if (notify) {
      this.#notify({ success, data });
    }
    return success;
  };

  #cronTask = async () => {
    try {
      const data = await this.#meter.getDay();
      if (data.valid) {
        this.#store(data, true);
      } else {
        this.#notify({ success: false, data: null });
      }
    } catch (error) {
      this.#logger.error("[CORE] Error executing cron task.", error);
    }
  };
}

module.exports = Core;
