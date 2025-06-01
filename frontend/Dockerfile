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

# Install serve globally
RUN npm install -g serve

# Expose port (Vite standard)
EXPOSE 5173

# Serve the built app on port 5173
CMD ["serve", "-s", "dist", "-l", "5173"]