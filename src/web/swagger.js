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
    },
    basedir: __dirname, //app absolute path
    files: ["./api/**/*.js"], //Path to the API handle folder
  };

  return expressSwagger(options);
};
