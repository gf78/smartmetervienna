FROM node:21.2.0-alpine3.17

WORKDIR /usr/src/app
RUN mkdir -p /usr/src/app/logs
RUN ln -s /usr/src/app/logs /logs

COPY package*.json ./

RUN npm install -g npm@latest
RUN npm ci

COPY . .

ENV TZ="Europe/Vienna"
ENV PORT=1978

RUN apk update
RUN apk add -U tzdata
RUN cp /usr/share/zoneinfo/Europe/Vienna /etc/localtime
RUN echo "Europe/Vienna" >  /etc/timezone
RUN apk del tzdata

EXPOSE 1978
CMD [ "node", "index.js" ]