# Production stage
FROM node:20-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create data directory
RUN mkdir -p /app/data

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy built application - only compiled files needed
COPY ./.next ./.next
COPY ./dist ./dist
COPY ./public ./public
COPY ./next.config.js ./next.config.js
