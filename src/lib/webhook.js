"use strict";
const Logger = require("./logger.js");

const METHODS = {
  get: "GET",
  post: "POST",
  put: "PUT",
  delete: "DELETE",
};

const DEFAULT_METHOD = "post";

class Webhook {
  #enabled;
  #method;
  #urls;
  #logger;

  constructor(
    {
      enabled = true,
      method = DEFAULT_METHOD,
      urls = {},
      logger = new Logger(),
    } = {
      enabled: true,
      method: DEFAULT_METHOD,
      urls: {},
      logger: new Logger(),
    }
  ) {
    try {
      this.#logger = typeof logger === "object" ? logger : new Logger();
      this.#enabled =
        String(enabled).toLowerCase() === "false" || enabled === false
          ? false
          : true;
      this.#urls = typeof urls === "object" && !Array.isArray(urls) ? urls : {};
      this.#method =
        METHODS[String(method || DEFAULT_METHOD).toLowerCase()] ||
        METHODS[DEFAULT_METHOD];
    } catch (error) {
      this.#logger.error("[WEBHOOK] Could not create webhook instance", error);
    }
  }

  send = async ({ cmd, data }) => {
    try {
      if (
        this.#enabled &&
        this.#method &&
        this.#urls &&
        typeof cmd === "string"
      ) {
        const url = typeof this.#urls[cmd] === "string" ? this.#urls[cmd] : cmd;

        this.#logger.verbose("[WEBHOOK] Sending webhook....", cmd);
        try {
          if (this.#method === METHODS.get) {
            fetch(url, {
              method: this.#method,
              cache: "no-cache",
              redirect: "follow",
            });
          } else {
            fetch(url, {
              method: this.#method,
              cache: "no-cache",
              redirect: "follow",
              headers: {
                "Content-Type": "application/json",
              },
              body:
                data !== undefined && data !== null
                  ? JSON.stringify(data)
                  : undefined,
            });
          }
        } catch (error) {
          this.#logger.error("[WEBHOOK] Could not send request.", cmd);
        }
      }
    } catch (error) {
      this.#logger.error("[WEBHOOK] Error while sending.", cmd);
    }
  };
}

module.exports = Webhook;
