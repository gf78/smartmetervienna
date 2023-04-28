# SmartMeter Vienna

- Github: https://github.com/gf78/smartmetervienna/
- Docker Hub: https://hub.docker.com/r/gf78/smartmetervienna

## Features

- Support **smart meters** used in **Vienna** by Wiener Netze
- Retrieve **power consumption** for a specific day (15 minutes interval)
- Store values to **influx database** (V2)
- Run daily **cron job** to store data
- Retrieve data via **REST API** without authorization
- Check service status on **Web UI**
- Receive **email notifications** about data update status
- Trigger **webhook requests** based on update status
- Extensive **logging** service
- Fully **dockerized** based on **Alpine Linux** image

## Prerequisites

- Customer of Wiener Netze
- Smart meter installed
- Account created https://smartmeter-web.wienernetze.at/
- Opt in to 15 minutes interval measurements

## Installation

Edit the `docker-compose.yml`file and create a new docker container:

```yaml
version: "3.3"
services:
  smartmetervienna:
    container_name: smartmetervienna
    image: "gf78/smartmetervienna:latest"
    restart: unless-stopped
    ports:
      - "80:1978"
    environment:
      PORT: 1978
      LOG_LEVEL: "error"
      CRON_SCHEDULE: "0 0 10 * * *"
      LOGWIEN_USERNAME: "xxx"
      LOGWIEN_PASSWORD: "xxx"
      INLUXDB_URL: "http://xxx:8086"
      INLUXDB_ORGANISATION: "xxx"
      INLUXDB_BUCKET: "smartmetervienna"
      INLUXDB_MEASUREMENT: "Wattage_15min_Wh"
      INLUXDB_TOKEN: "xxx"
      SMTP_HOST: "xxx"
      SMTP_PORT: 587
      SMTP_SECURE: false
      SMTP_CIPHERS: "SSLv3"
      SMTP_USERNAME: "xxx"
      SMTP_PASSWORD: "xxx"
      SMTP_FROM: "xxx"
      SMTP_TO: "xxx"
      MAIL_ENABLED: false
      MAIL_SUBJECT: "SmartMeter Vienna"
      MAIL_ON_SUCCESS: true
      MAIL_ON_FAILURE: true
      MAIL_ON_RESTART: true
      WEBHOOK_ENABLED: false
      WEBHOOK_METHOD: POST
      WEBHOOK_URL_RESTART: "http(s)://xxx"
      WEBHOOK_URL_SUCCESS: "http(s)://xxx"
      WEBHOOK_URL_FAILURE: "http(s)://xxx"
    volumes:
      - "smartmetervienna-logs:/logs"
volumes:
  smartmetervienna-logs:
    external: true
    name: smartmetervienna-logs
```

## Configuration

Use the following environment variables to configure the service

| Variable             | Description                                         | Mandatory |
| -------------------- | --------------------------------------------------- | --------- |
| LOGWIEN_USERNAME     | Username for smart meter portal of Wiener Netze     | yes       |
| LOGWIEN_PASSWORD     | Password for smart meter portal of Wiener Netze     | yes       |
| METER_ID             | Meter id (Zählerpunkt) of Wiener Netze              | no        |
| INLUXDB_URL          | URL of influx db `http://xxx:8086`                  | no        |
| INLUXDB_TOKEN        | Token of influx db                                  | no        |
| INLUXDB_ORGANISATION | Organisation of influx db                           | no        |
| INLUXDB_BUCKET       | Bucket of influx db                                 | no        |
| INLUXDB_MEASUREMENT  | Measurement name for influx db                      | no        |
| PORT                 | Web service port `1978`                             | no        |
| LOG_LEVEL            | Level of logging service `error`, `info`, `verbose` | no        |
| CRON_SCHEDULE        | Schedule for cron job `0 0 10 * * *`                | no        |
| SMTP_HOST            | SMTP server host                                    | no        |
| SMTP_PORT            | SMTP server port `587`                              | no        |
| SMTP_SECURE          | SMTP server sercurity `true`, `false`               | no        |
| SMTP_CIPHERS         | SMTP server ciphers `SSLv3`                         | no        |
| SMTP_USERNAME        | SMTP server username                                | no        |
| SMTP_PASSWORD        | SMTP server password                                | no        |
| SMTP_FROM            | Sender email address                                | no        |
| MAIL_ENABLED         | Email notifications enabled: `true`, `false`        | no        |
| MAIL_TO              | Receipients email address                           | no        |
| MAIL_SUBJECT         | Email subject                                       | no        |
| MAIL_ON_SUCCESS      | Send otifications on success: `true`, `false`       | no        |
| MAIL_ON_FAILURE      | Send otifications on failure: `true`, `false`       | no        |
| MAIL_ON_RESTART      | Send otifications on restart: `true`, `false`       | no        |
| WEBHOOK_ENABLED      | Webhook notifications enabled: `true`, `false`      | no        |
| WEBHOOK_METHOD       | Webhook protocol: `POST`, `GET`                     | no        |
| WEBHOOK_URL_RESTART  | Webhook URL on restart                              | no        |
| WEBHOOK_URL_SUCCESS  | Webhook URL on success                              | no        |
| WEBHOOK_URL_FAILURE  | Webhook URL on failure                              | no        |

## APIs

### Wattage

- Yesterday: `/api/v1/wattage`
- Day by date: `/api/v1/wattage/YYYY-MM-DD`
- Store to DB: `/api/v1/wattage?store=true`
- Notify: `/api/v1/wattage?notify=true`
- HTML format: `/api/v1/wattage?format=html`
- Combination: `/api/v1/wattage/YYYY-MM-DD?format=html&store=true&notify=true`

```json
[
  {
    "isValid": true,
    "error": null,
    "meter": "AT0010000000000000001xxxxxxxxx",
    "unit": "Wh",
    "measurement": "consumption",
    "consumptionUnit": "Wh",
    "loadUnit": "W",
    "value": 78,
    "consumption": 78,
    "load": 312,
    "timestamp": "2023-04-24T22:00:00.000Z",
    "periodStart": "2023-04-24T22:00:00.000Z",
    "periodEnd": "2023-04-24T22:14:59.999Z",
    "raw": {
      "value": 78,
      "timestamp": "2023-04-24T22:00:00.000Z",
      "isEstimated": false
    },
    "lastModified": "2023-04-27T16:27:53.312Z"
  },
  {}
]
```

### Log

- JSON format: `/api/v1/log`
- HTML format: `/api/v1/log?format=html`

```json
[
  {
    "level": "info",
    "message": "[WEB] Listening on port 1978",
    "timestamp": "2023-04-27T06:45:46.806Z"
  },
  {}
]
```

## Web UI

Access the status page: `//your-server:your-port/`

## Notification

### E-Mail

Configure the SMTP/Email service to receive emails in case of `restart`, `success` and `failure`.

### Webhook

Configure the webhook service to receive `GET` or `POST` webhook requests in case of `restart`, `success` and `failure`. The payload of a `POST` request will include the retrieved measurement data.
