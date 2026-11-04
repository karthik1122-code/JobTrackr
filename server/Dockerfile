# Small official Node image (Alpine Linux)
FROM node:22-alpine

# run in production mode inside the container
ENV NODE_ENV=production

WORKDIR /app

# copy only the package files first, so Docker can cache the npm install layer
# and skip it when only the code changes
COPY package*.json ./
RUN npm ci --omit=dev

# then the code
COPY src ./src
COPY scripts ./scripts

# don't run as root
USER node

# the app reads PORT from the environment, 5000 if it isn't set
EXPOSE 5000

CMD ["node", "src/server.js"]
