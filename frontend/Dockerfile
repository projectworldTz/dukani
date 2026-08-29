FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Baked into the built JS at build time (Vite convention) — pass the real API origin
# for the target environment, e.g. --build-arg VITE_API_URL=https://api.example.com/api/v1
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
