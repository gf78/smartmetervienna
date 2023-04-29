const express = require("express");

module.exports = function ({ logger, send }) {
  const router = express.Router();

  /**
   * @typedef LogEntry
   * @property {enum} level.required - severity level - eg: error,debug,warn,data,info,verbose,silly
   * @property {string} message.required - message - eg: [ERROR] Could not ...
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:10:19.776Z
   * @property {Array.object} details.optional - optional detail data
   */

  /**
   * Get log
   * @route GET /log
   * @group LOG
   * @param {enum} [format.query.optional = json] - Format of the resonse (default: json) - eg: json,html
   * @produces application/json application/xhtml+xml
   * @returns {Array.<LogEntry>} List of LogEntries - [...]
   */

  router.get("/log", (request, response) => {
    try {
      logger.verbose("[API] GET /log");
      send({ request, response, data: logger.getLog() });
    } catch (error) {
      logger.error("[API] /log", error);
      response.error(500).json({ error });
    }
  });

  return router;
};
