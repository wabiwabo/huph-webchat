FROM node:20-alpine

WORKDIR /app

# Install Redis client
RUN apk add --no-cache redis

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Expose ports
EXPOSE 3103 3104

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3104/health || exit 1

# Start server
CMD ["node", "server.js"]
