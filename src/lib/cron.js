"use strict";
const cron = require("node-cron");
const Logger = require("./logger.js");

class Cron {
  #task;
  #logger;

  constructor(
    { schedule = null, task = null, logger = new Logger() } = {
      schedule: null,
      task: null,
      logger: new Logger(),
    }
  ) {
    try {
      this.#logger = typeof logger === "object" ? logger : new Logger();

      if (typeof task === "function") {
        if (
          schedule &&
          typeof schedule === "string" &&
          cron.validate(schedule)
        ) {
          this.#task = task;
          cron.schedule(schedule, async () => {
            try {
              this.#task();
            } catch (error) {
              logger.error("[CRON] Error executing the task.", error);
            }
          });
        } else {
          this.#logger.error(
            `[CRON] Could not create cron job, invalid schedule. (${schedule})`
          );
        }
      } else {
        this.#logger.error(
          `[CRON] Could not create cron job, invalid task. (${typeof task})`
        );
      }
    } catch (error) {
      this.#logger.error(`[CRON] Could not initialize instance.`);
    }
  }
}

module.exports = Cron;
