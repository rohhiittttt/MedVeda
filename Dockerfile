# ========================================================
# MedVeda Unified Production Server (Node.js + Python AI)
# Runs both Server 1 (Frontend/API) and Server 2 (Python RAG)
# ========================================================

FROM node:20-bookworm-slim

# Install Python 3, pip, and required system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Symlink python to python3
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# 1. Install Python dependencies first for caching
COPY python_service/requirements.txt ./python_service/requirements.txt
RUN pip3 install --no-cache-dir -r python_service/requirements.txt --break-system-packages

# 2. Install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci

# 3. Copy full project source
COPY . .

# 4. Precompile frontend application
RUN node frontend/build.js

# 5. Environment configuration
ENV PORT=3000
ENV PYTHON_PORT=8001
ENV PYTHON_PATH=/usr/bin/python3
ENV NODE_ENV=production

EXPOSE 3000

# 6. Start Unified Server:
# Node.js listens on $PORT (auto-provided by Render/Railway)
# and automatically boots the internal Python AI & Voice Service on port 8001
CMD ["npx", "tsx", "frontend/server.js"]
