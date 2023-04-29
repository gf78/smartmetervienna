const express = require("express");

module.exports = function ({ config, logger }) {
  const router = express.Router();

  router.get("/", (request, response) => {
    logger.verbose("[API] GET /");
    const days = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i - 2);
      return date.toISOString().slice(0, 10);
    });

    response.render("home", {
      config: config,
      days,
      log: logger.getRecent(),
    });
  });

  return router;
};
