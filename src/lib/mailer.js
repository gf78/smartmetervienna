"use strict";

const nodemailer = require("nodemailer");
const Logger = require("./logger.js");

class Mailer {
  #transporter;
  #from;
  #to;
  #subject;
  #logger;

  constructor(
    {
      enabled = true,
      host,
      port = 587,
      secure = false,
      username,
      password,
      from,
      to,
      subject = "Automatisches E-Mail",
      ciphers = "SSLv3",
      logger = new Logger(),
    } = {
      logger: new Logger(),
    }
  ) {
    this.#logger = typeof logger === "object" ? logger : new Logger();
    try {
      if (enabled) {
        this.#logger.verbose("[MAILER] Creating Mailer");
        this.#transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user: username,
            pass: password,
          },
          tls: {
            ciphers,
            rejectUnauthorized: false,
          },
        });

        this.#from = typeof from === "string" ? from : null;
        this.#to = to;
        this.#subject = typeof subject === "string" ? subject : null;
      }
    } catch (error) {
      this.#logger.error("[MAILER] Could not create mailer", error);
    }
  }

  send = async ({ to = this.#to, subject = this.#subject, text, html }) => {
    try {
      if (this.#transporter) {
        this.#logger.verbose("[MAILER] Sending email ...", to, subject);
        return await this.#transporter.sendMail({
          from: this.#from,
          to,
          subject,
          text,
          html,
        });
      } else {
        return false;
      }
    } catch (error) {
      this.#logger.error("[MAILER] Could not send email.", error);
    }
  };
}

module.exports = Mailer;
