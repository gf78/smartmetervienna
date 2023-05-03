"use strict";

const Logger = require("./logger.js");

const REF = {
  header: "X-API-Key",
  query: "api_key",
  cookie: "X-API-KEY",
};

class ApiKey {
  #apiKey;
  #redirect;
  #logger;

  constructor(
    { apiKey = null, redirect = null, logger = new Logger() } = {
      apiKey: null,
      redirect: null,
      logger: new Logger(),
    }
  ) {
    this.#apiKey = typeof apiKey === "string" ? apiKey : null;
    this.#redirect = typeof redirect === "string" ? redirect : null;
    this.#logger = typeof logger === "object" ? logger : new Logger();
  }

  #getCookies = (req) => {
    try {
      const regex = /([^;=\s]*)=([^;]*)/g;
      let cookies = {};
      for (let cookie; (cookie = regex.exec(req?.headers?.cookie || "")); )
        cookies[cookie[1]] = decodeURIComponent(cookie[2]);
      return cookies;
    } catch (error) {
      this.#logger.verbose("[APIKEY]: Cookies parsing error.");
      return {};
    }
  };

  protect = (req, res, next) => {
    this.#logger.verbose("[APIKEY]: Protecting routes ...");
    if (this.#apiKey) {
      const apiKey =
        req?.get(REF.header) ||
        req?.query[REF.query] ||
        this.#getCookies(req)[REF.cookie];

      if (!apiKey || apiKey !== this.#apiKey) {
        this.#logger.info("[APIKEY]: Unauthorized access blocked.");

        if (
          this.#redirect &&
          this.#getCookies(req)["accept"] !== "application/json"
        ) {
          res.status(401).redirect(this.#redirect);
        } else {
          res.status(401).json({ error: "unauthorised" });
        }
      } else {
        this.#logger.debug("[APIKEY]: Access authorized.");

        if (this.#getCookies(req)[REF.cookie] !== this.#apiKey) {
          this.#logger.debug("[APIKEY]: Store X-API-KEY cookie.");
          res.cookie(REF.cookie, this.#apiKey, {
            secure: true,
            httpOnly: true,
          });
        }

        next();
      }
    } else {
      this.#logger.verbose(
        "[APIKEY]: No apiKey defined. All routes are public."
      );
      next();
    }
  };
}

module.exports = ApiKey;
