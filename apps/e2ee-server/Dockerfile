FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./

RUN yarn install --immutable

COPY . .

RUN yarn run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tzdata && rm -rf /var/cache/apk/*

COPY --from=build /app /app

ENV TZ="Asia/Shanghai"

EXPOSE 3868

CMD ["yarn", "run", "start"]
