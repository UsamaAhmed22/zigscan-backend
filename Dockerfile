FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies needed for the build
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Clean previous build and rebuild
RUN rm -rf dist && npm run build

# Ensure assets are copied to dist
RUN mkdir -p dist/assets && cp -r src/assets/* dist/assets/ || true

# Verify build output
RUN ls -la dist/ && echo "Build completed successfully"

FROM node:20-alpine AS runner
WORKDIR /app

# Install required system packages for SSH tunneling and health checks
RUN apk add --no-cache \
    wget \
    openssh-client \
    bash \
    coreutils \
    netcat-openbsd \
    psmisc \
    sshpass

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --only=production --legacy-peer-deps 

# Copy compiled sources and assets
COPY --from=builder /app/dist ./dist

# Copy startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create directory for SSH keys
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

ENV NODE_ENV=production
ENV USE_SSH_TUNNEL=true
EXPOSE 8000

# Use the startup script as entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]
