# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.12.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
ARG YARN_VERSION=1.22.22
RUN npm install -g yarn@$YARN_VERSION --force

# Build stage
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Copy package.json, yarn.lock, and tsconfig.json
COPY --link package.json yarn.lock tsconfig.json ./

# Install dependencies including devDependencies
RUN yarn install --frozen-lockfile --production=false

# Copy application code
COPY --link src ./src

# Build the TypeScript code
RUN yarn build

# Final stage
FROM base

# Copy production dependencies
COPY --from=build /app/node_modules /app/node_modules

# Copy built application
COPY --from=build /app/dist ./dist

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "node", "dist/index.js" ]

