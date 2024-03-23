FROM node:21-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
COPY tsconfig.json /usr/src/app/
COPY src/* /usr/src/app/src/

RUN npm i
RUN npm run build

CMD [ "npm", "start" ]
