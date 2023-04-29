"use strict";

const express = require("express");

const Logger = require("../lib/logger.js");
const home = require("./home.js");
const apiLog = require("../api/log.js");
const apiMeter = require("../api/meter.js");
const swagger = require("./swagger.js");

class Web {
  #app;
  #logger;
  #getMeterData;
  #store;
  #config;
  #apiPath;

  constructor(
    {
      port = 80,
      views = "./views",
      engine = "pug",
      apiPath = "/api/v1",
      getMeterData,
      logger = new Logger(),
      store = () => {},
      config = {},
    } = {
      port: 80,
      views: "./views",
      engine: "pug",
      apiPath: "/api/v1",
      getMeterData: () => {},
      logger: new Logger(),
      store: () => {},
      config: {},
    }
  ) {
    this.#logger = typeof logger === "object" ? logger : new Logger();

    try {
      this.#getMeterData = getMeterData;
      this.#apiPath = apiPath;
      this.#store = store;
      this.#config = config;
      this.#app = express();
      this.#app.set("view engine", engine);
      this.#app.set("views", views);

      // Home
      this.#app.use("/", home({ config: this.#config, logger: this.#logger }));

      // API : log
      this.#app.use(
        apiPath,
        apiLog({
          config: this.#config,
          logger: this.#logger,
          send: this.#send,
        })
      );

      // API : meter
      this.#app.use(
        apiPath,
        apiMeter({
          getMeterData: this.#getMeterData,
          logger: this.#logger,
          send: this.#send,
          store: this.#store,
        })
      );

      //API swagger documentation: /api-docs#
      swagger({
        app: this.#app,
        apiPath,
        config: this.#config,
      });

      this.#app.listen(port, () => {
        this.#logger.info(`[WEB] Listening on port ${port}`);
      });
    } catch (error) {
      this.#logger.error("[WEB] Could not create instance", error);
    }
  }

  #send = ({ request, response, data, template = "api" }) => {
    if (String(request.query?.format).toLowerCase() === "html") {
      return response.status(200).render(template, {
        url: this.#apiPath + request.url,
        response: JSON.stringify(data, null, 4),
      });
    } else {
      return response.status(200).json(data);
    }
  };
}

module.exports = Web;
