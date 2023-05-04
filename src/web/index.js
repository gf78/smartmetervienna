"use strict";

const express = require("express");

const Logger = require("../lib/logger.js");
const authorize = require("../lib/authorize.js");
const date = require("../lib/date.js");
const apiLog = require("./api/log.js");
const apiMeter = require("./api/meter.js");
const swagger = require("./swagger.js");

class Web {
  #app;
  #logger;
  #config;

  constructor(
    {
      port = 80,
      apiPath = "/api/v1",
      apiKey = null,
      views = "./views",
      engine = "pug",
      meter,
      logger = new Logger(),
      store = () => {},
      config = {},
    } = {
      port: 80,
      apiPath: "/api/v1",
      apiKey: null,
      views: "./views",
      engine: "pug",
      meter,
      logger: new Logger(),
      store: () => {},
      config: {},
    }
  ) {
    this.#logger = typeof logger === "object" ? logger : new Logger();

    try {
      this.#config = config;
      this.#app = express();
      this.#app.set("view engine", engine);
      this.#app.set("views", views);

      // Login
      this.#app.get("/login", (req, res) => {
        res.render("login");
      });

      // Protect all following routes
      this.#app.use(
        authorize({ apiKey, login: "/login", logger: this.#logger })
      );

      // Home
      this.#app.get("/", async (req, res) => {
        let newestVersion = "unkown";
        try {
          newestVersion = (
            await (
              await fetch(
                "https://raw.githubusercontent.com/gf78/smartmetervienna/main/package.json"
              )
            ).json()
          )?.version;
        } catch (error) {
          this.#logger.debug(
            "[WEB] Could not load latest version from github",
            error
          );
        }
        res.render("home", {
          config,
          newestVersion,
        });
      });

      // Log
      this.#app.get("/log", (req, res) => {
        res.render("log", {
          log: logger.getLog(),
        });
      });

      // Config
      this.#app.get("/config", (req, res) => {
        res.render("config", {
          config: config._filtered,
        });
      });

      // Info
      this.#app.get("/info", (req, res) => {
        res.render("info");
      });

      // Import
      this.#app.get("/import", async (req, res) => {
        let count = null;
        try {
          if (req?.query?.from) {
            count = 0;
            const data = await meter.getMeasurements({
              from: req?.query?.from,
              to: req?.query?.to,
              id: req?.query?.id,
            });
            if (Array.isArray(data)) {
              count = store(data) ? data.length : 0;
            }
          }
        } catch (error) {
          this.#logger.error("[WEB] Could not import measurements", error);
        }

        res.render("import", {
          config,
          count,
          from: req?.query?.from || date.getDateString(),
          to: req?.query?.to || date.getDateString(),
        });
      });

      // API : log
      this.#app.use(
        apiPath,
        apiLog({
          config: this.#config,
          logger: this.#logger,
        })
      );

      // API : meter
      this.#app.use(
        apiPath,
        apiMeter({
          meter,
          logger: this.#logger,
          store,
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
}

module.exports = Web;
