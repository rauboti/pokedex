# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /web
RUN corepack enable

# The @rauboti registry token is substituted into the yarnrc from a BuildKit secret, then the
# placeholder template is restored over it — all in one RUN, so the real token never lands in a
# layer. The yarnrc itself must stay: without it Yarn falls back to PnP and ignores node_modules.
COPY .yarnrc.yml.example package.json yarn.lock ./
RUN --mount=type=secret,id=rauboti_token \
    sed "s|<your-token>|$(cat /run/secrets/rauboti_token)|" .yarnrc.yml.example > .yarnrc.yml \
 && yarn install --immutable \
 && cp .yarnrc.yml.example .yarnrc.yml

COPY . .
RUN yarn build

# ---- Runtime stage: nginx serving the static build ----
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80
