const express = require("express");

module.exports = function ({ logger }) {
  const router = express.Router();

  /**
   * @typedef LogEntry
   * @property {enum} level.required - severity level - eg: error,debug,warn,data,info,verbose,silly
   * @property {string} message.required - message - eg: [ERROR] Could not ...
   * @property {string} timestamp.required - ISO timestamp - eg: 2023-12-31T15:10:19.776Z
   * @property {Array.object} details.optional - optional detail data
   */

  /**
   * Retrieve log
   * @route GET /log
   * @group LOG
   * @param {enum} [level.query ] - filter by level - eg: error,debug,warn,data,info,verbose,silly
   * @param {int} [length.query] - max. number of entries - eg: 10
   * @param {enum} [sort.query = asc] - sort order - eg: asc,desc
   * @produces application/json
   * @returns {Array.<LogEntry>} List of LogEntries - [...]
   */

  router.get("/log", (request, response) => {
    try {
      logger.verbose("[API] GET /log");

      const data = logger.getLog({
        level: request?.query?.level,
        length: request?.query?.length,
        sort: request?.query?.sort,
      });

      response.status(200).json(data);
    } catch (error) {
      logger.error("[API] /log", error);
      response.status(500).json({ error });
    }
  });

  return router;
};
