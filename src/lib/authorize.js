"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const Logger = require("./logger.js");

const REF = {
  header: "X-API-Key",
  query: "api_key",
  body: "api_key",
  cookie: "X-API-KEY",
};

module.exports = (
  { apiKey = null, login = "/login", logger = new Logger() } = {
    apiKey: null,
    redirect: null,
    login: "/login",
    logger: new Logger(),
  }
) => {
  const router = express.Router();

  router.use(cookieParser());

  router.use(bodyParser.urlencoded({ extended: true }));

  router.use("/logout", (req, res, next) => {
    res.clearCookie(REF.cookie);
    res.redirect(login);
  });

  router.use("/", (req, res, next) => {
    logger.verbose("[APIKEY]: Protecting routes ...");
    if (apiKey) {
      const reqApiKey =
        req?.get(REF.header) ||
        req?.query[REF.query] ||
        req?.body[REF.body] ||
        req?.cookies[REF.cookie];

      if (!reqApiKey || reqApiKey !== apiKey) {
        logger.info("[APIKEY]: Unauthorized access blocked.");

        if (login && req?.headers["accept"] !== "application/json") {
          res.status(401).redirect(login);
        } else {
          res.status(401).json({ error: "unauthorised" });
        }
      } else {
        logger.debug("[APIKEY]: Access authorized.");

        if (req?.cookies[REF.cookie] !== apiKey) {
          logger.debug("[APIKEY]: Store X-API-KEY cookie.");
          res.cookie(REF.cookie, apiKey, {
            secure: true,
            httpOnly: true,
          });
        }

        next();
      }
    } else {
      logger.verbose("[APIKEY]: No apiKey defined. All routes are public.");
      next();
    }
  });

  return router;
};
