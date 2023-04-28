"use strict";

const express = require("express");
const helmet = require("helmet");

const Logger = require("./logger.js");

class Web {
  #app;
  #logger;
  #meter;
  #store;
  #config;

  constructor(
    {
      port = 80,
      views = "./views",
      engine = "pug",
      meter,
      logger = new Logger(),
      store = () => {},
      config = {},
    } = {
      port: 80,
      views: "./views",
      engine: "pug",
      logger: new Logger(),
      store: () => {},
      config: {},
    }
  ) {
    this.#logger = typeof logger === "object" ? logger : new Logger();

    try {
      this.#meter = meter;
      this.#store = store;
      this.#config = config;
      this.#app = express();
      this.#app.use(helmet());
      this.#app.set("view engine", engine);
      this.#app.set("views", views);

      this.#app.get("/api/v1/wattage/:date?", async (request, response) => {
        try {
          this.#logger.verbose(
            "[API] GET /api/v1/wattage/:date?",
            request.params?.date
          );
          const data = await this.#meter.getWattage(request.params?.date);
          this.#sendResponse({ request, response, data });

          if (
            !!data &&
            (request.query?.save === true ||
              String(request.query?.store).toLowerCase() === "true")
          ) {
            this.#store(
              data,
              String(request.query?.notify).toLowerCase() === "true"
                ? true
                : false
            );
          }
        } catch (error) {
          this.#logger.error("[API] /api/v1/wattage/:date", error);
          response.json({ error });
        }
      });

      this.#app.get("/api/v1/log", (request, response) => {
        try {
          this.#logger.verbose("[API] GET /api/v1/log");
          this.#sendResponse({ request, response, data: logger.getLog() });
        } catch (error) {
          this.#logger.error("[API] /api/v1/log", error);
          response.json({ error });
        }
      });

      this.#app.get("/", (request, response) => {
        this.#logger.verbose("[API] GET /");
        const days = Array.from({ length: 6 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i - 2);
          return date.toISOString().slice(0, 10);
        });

        response.render("home", {
          config: this.#config,
          days,
          log: this.#logger.getRecent(),
        });
      });

      this.#app.listen(port, () => {
        this.#logger.info(`[WEB] Listening on port ${port}`);
      });
    } catch (error) {
      this.#logger.error("[WEB] Could not create instance", error);
    }
  }

  #sendResponse = ({ request, response, data, template = "api" }) => {
    if (String(request.query?.format).toLowerCase() === "html") {
      return response.render(template, {
        url: request.url,
        response: JSON.stringify(data, null, 4),
      });
    } else {
      return response.json(data);
    }
  };
}

module.exports = Web;
