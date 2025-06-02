FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Install serve globally for production serving
RUN npm install -g serve

# Create a simple HTTP server configuration for CORS
RUN echo '#!/bin/sh\nserve -s dist -l 5173 --cors' > /start.sh && chmod +x /start.sh

# Expose port
EXPOSE 5173

# Use custom start script that enables CORS
CMD ["/start.sh"]