"use strict";

const { deepmerge } = require("deepmerge-ts");
const entities = require("entities");
const { configureRefreshFetch } = require("refresh-fetch");
const makeFetchCookie = require("fetch-cookie");
const fetchCookie = makeFetchCookie(fetch);

const Logger = require("./logger.js");

const AUTH_URL =
  "https://log.wien/auth/realms/logwien/protocol/openid-connect/";

class LogWien {
  #clientId;
  #redirectUri;
  #username;
  #password;
  #token;
  #lastAuthTS;
  #refreshFetch;
  #logger;

  constructor(
    { username, password, clientId, redirectUri, logger = new Logger() } = {
      logger: new Logger(),
    }
  ) {
    this.#logger = typeof logger === "object" ? logger : new Logger();
    this.#username = typeof username === "string" ? username : null;
    this.#password = typeof password === "string" ? password : null;
    this.#clientId = typeof clientId === "string" ? clientId : null;
    this.#redirectUri = typeof redirectUri === "string" ? redirectUri : null;
    this.#token = {};
    this.#refreshFetch = configureRefreshFetch({
      fetchCookie,
      fetch,
      shouldRefreshToken: (error) =>
        error.response.status === 401 || error.response.status === 403,
      refreshToken: this.#refresh,
    });
  }

  fetch = async (url, options = {}, ...args) => {
    this.#logger.verbose("[LOGWIN] Fetching URL ...", url);
    const isAuthenticated = await this.#authenticate();
    let response = false;
    try {
      response = isAuthenticated
        ? await this.#refreshFetch(
            url,
            deepmerge(options || {}, {
              headers: { Authorization: "Bearer " + this.#token?.access_token },
            }),
            ...args
          )
        : false;
    } catch (error) {
      this.#logger.error("[LOGWIN] Fetching Error", url);
    }
    return response;
  };

  #login = async () => {
    try {
      this.#logger.verbose("[LOGWIN] Loggin in ...");
      this.#token = {};
      const urlAction = await fetchCookie(
        AUTH_URL +
          "auth?" +
          new URLSearchParams(
            {
              client_id: this.#clientId,
              redirect_uri: this.#redirectUri,
              response_mode: "fragment",
              response_type: "code",
              scope: "openid",
              nonce: "",
              prompt: "login",
            },
            {
              credentials: "include",
              cache: "no-store",
            }
          )
      )
        .then((response) => response.text())
        .then((body) => {
          return entities.decodeHTML(
            /"(https\:\/\/log\.wien\/auth.*)"/.exec(body)[1]
          );
        });

      const code = await fetchCookie(urlAction, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: this.#username,
          password: this.#password,
        }),
        method: "post",
        redirect: "manual",
        credentials: "include",
        cache: "no-store",
      }).then(
        (response) => /code=([^&]*)/.exec(response.headers.get("location"))[1]
      );

      this.#token = await fetchCookie(AUTH_URL + "token", {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code: code,
          grant_type: "authorization_code",
          client_id: this.#clientId,
          redirect_uri: this.#redirectUri,
        }),
        method: "post",
        redirect: "manual",
        credentials: "include",
        cache: "no-store",
      }).then((response) => response.json());

      this.#lastAuthTS = Date.now() / 1000;
      return !!this.#token.access_token;
    } catch (error) {
      this.#logger.error("[LOGWIN] Login Error", error);
      this.#token = {};
      return false;
    }
  };

  #refresh = async () => {
    try {
      this.#logger.verbose("[LOGWIN] Refreshing token ...");
      if (!this.#token?.refresh_token) {
        throw "no refresh token";
      }
      this.#token = await fetchCookie(AUTH_URL + "token", {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.#token?.refresh_token,
          client_id: this.#clientId,
        }),
        method: "post",
        redirect: "manual",
        credentials: "include",
        cache: "no-store",
      }).then((response) => response.json());

      this.#lastAuthTS = Date.now() / 1000;
      return !!this.#token.access_token;
    } catch (e) {
      this.#logger.error("[LOGWIN] Refresh token Error", error);
      // Try login, if refresh fails
      return await this.#login();
    }
  };

  #authenticate = async () => {
    if (
      !this.#token ||
      !this.#lastAuthTS ||
      !this.#token?.refresh_token ||
      this.#lastAuthTS + this.#token?.refresh_expires_in <= Date.now() / 1000
    ) {
      return await this.#login();
    } else if (
      !this.#token?.access_token ||
      this.#lastAuthTS + this.#token.expires_in <= Date.now() / 1000
    ) {
      return await this.#refresh();
    } else {
      this.#logger.verbose("[LOGWIN] Valid authentication available");
      return true;
    }
  };
}

module.exports = LogWien;
