FROM node:22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        unzip \
        ca-certificates \
        openssh-client \
        ripgrep \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code@latest

WORKDIR /workspace

CMD ["sleep", "infinity"]
