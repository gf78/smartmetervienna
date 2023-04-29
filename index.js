"use strict";

const Core = require("./src/core.js");

try {
  const core = new Core();
} catch (error) {
  console.error("[MAIN] Unkown Error", error);
}
