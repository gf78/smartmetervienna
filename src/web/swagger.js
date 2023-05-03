"use strict";

module.exports = function ({ app, apiPath, config }) {
  const expressSwagger = require("express-swagger-generator")(app);

  let options = {
    swaggerDefinition: {
      info: {
        //       description: config?.service?.description,
        title: config?.service?.name,
        version: config?.service?.version,
      },
      basePath: apiPath,
      produces: ["application/json", "application/xhtml+xml"],
      schemes: ["http", "https"],

      securityDefinitions: {
        Header: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "apiKey as header",
        },
        Query: {
          type: "apiKey",
          in: "query",
          name: "api_key",
          description: "apiKey as query",
        },
        Cookie: {
          type: "apiKey",
          in: "cookie",
          name: "X-API-KEY",
          description: "apiKey as cookie",
        },
      },

      security: [{ Header: [] }, { Query: [] }, { Cookie: [] }],
      defaultSecurity: "Header",
    },
    basedir: __dirname, //app absolute path
    files: ["./api/**/*.js"], //Path to the API handle folder
  };

  return expressSwagger(options);
};
