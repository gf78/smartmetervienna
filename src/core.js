"use strict";
const fs = require("fs");

const Logger = require("./lib/logger.js");
const Meter = require("./lib/meter.js");
const DB = require("./lib/db.js");
const Cron = require("./lib/cron.js");
const Mailer = require("./lib/mailer.js");
const Webhook = require("./lib/webhook.js");
const date = require("./lib/date.js");

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
          meter: this.#meter,
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
        .replaceAll("%%FROM%%", data?.job?.from || "(unkown)")
        .replaceAll("%%TO%%", data?.job?.to || "(unkown)")
        .replaceAll("%%DAYS%%", data?.job?.days || "(unkown)")
        .replaceAll("%%COUNT%%", data?.count?.actual || 0)
        .replaceAll("%%RATE%%", data?.count?.rate + " %" || "(unkown)")
        .replaceAll("%%SUCCESS%%", data?.success?.overall ? true : false);
    } catch (error) {
      return text;
    }
  };

  // Webhook: Success/Failure notification
  #notifyWebhook = ({ success, data }) => {
    try {
      this.#logger.verbose("[CORE] Notify via webhook ...");
      this.#webhook.send({
        cmd: this.#notifyFormatter(
          success
            ? this.#config?.webhook?.urls?.success
            : this.#config?.webhook?.urls?.failure,
          data
        ),
        data,
      });
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
            "Datenimport %%FROM%% bis %%TO%% (%%DAYS%% Tage) war zu %%RATE%% erfolgreich.\nEs wurden ingesamt %%COUNT%% Messpunkte gespeichert.\n\n",
            data
          ),
        });
      } else if (!success && this.#config.mailer.onError) {
        this.#mailer.send({
          text: this.#notifyFormatter(
            "Datenimport %%FROM%% bis %%TO%% (%%DAYS%% Tage) war zu %%RATE%% erfolgreich.\nEs wurden ingesamt %%COUNT%% Messpunkte gespeichert.\n\n",
            data
          ),
          data,
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

  // DB: Store data
  #store = async (data) => {
    this.#logger.verbose("[CORE] Storing data to DB ...");
    let success = false;
    try {
      if (Array.isArray(data) && data.length > 0) {
        success = await this.#db.write(data);
        if (success) {
          this.#logger.info("[CORE] Data stored successfully to DB.");
        } else {
          this.#logger.error("[CORE] Data could not be stored to DB.");
        }
      }
    } catch (error) {
      this.#logger.error("[CORE] Data could not be stored.", error);
    }

    return success;
  };

  #cronTask = async () => {
    try {
      const { to, from, days } = date.getDateRange(this.#config.cron.days);
      this.#logger.verbose("[CORE] Run cron job", from, to, days);
      const measurements = await this.#meter.getMeasurements({ from, to });

      const data = {
        job: {
          schedule: this.#config?.cron?.schedule,
          days: this.#config?.cron?.days,
          from,
          to,
          run: new Date(),
        },
        count: {
          actual: (measurements || []).length,
          expected: days * 4 * 24,
        },
        success: {
          store: await this.#store(measurements),
        },
        measurements,
      };
      data.count.rate =
        data.count.expected > 0
          ? Math.round((data?.count?.actual / data?.count?.expected) * 100)
          : 100;

      data.success.fetch = !!(data?.count?.rate === 100);
      data.success.overall = !!(data?.success?.fetch && data?.success?.store);

      this.#notify({
        success: data?.success?.overall,
        data,
      });
      return data;
    } catch (error) {
      this.#logger.error("[CORE] Error executing cron task.", error);
    }
  };
}

module.exports = Core;
