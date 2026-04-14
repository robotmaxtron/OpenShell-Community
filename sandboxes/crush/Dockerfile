# syntax=docker/dockerfile:1

# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

# OpenShell Community Crush sandbox image
#
# Provides the foundational system tools, users, and developer environment
# for the Crush coding agent.
#
# Build:  docker build -t openshell-crush .

# System base
FROM nvcr.io/nvidia/base/ubuntu:noble-20251013 AS system

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /sandbox

# Core system dependencies
# iproute2: network namespace management (ip netns, veth pairs)
# iptables: bypass detection — LOG + REJECT rules for direct connection diagnostics
# dnsutils: dig, nslookup
# Python is managed entirely by uv (see devtools stage).
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        dnsutils \
        iproute2 \
        iptables \
        iputils-ping \
        net-tools \
        netcat-openbsd \
        openssh-sftp-server \
        procps \
        traceroute \
    && rm -rf /var/lib/apt/lists/*

# Create supervisor and sandbox users/groups
RUN groupadd -r supervisor && useradd -r -g supervisor -s /usr/sbin/nologin supervisor && \
    groupadd -r sandbox && useradd -r -g sandbox -d /sandbox -s /bin/bash sandbox

# Developer tools
FROM system AS devtools

# Node.js 22 + build toolchain (needed by npm packages with native addons).
# Pin to a specific patch version for reproducible builds.
# CVE-2026-21637, CVE-2025-59466, CVE-2025-59465, CVE-2025-55131 were addressed
# in Node.js 22.22.1.
#
# npm is upgraded to v11 in the same layer to avoid caching the old npm.
# npm 11 ships tar@^7.5.9, fixing tar@6.2.1 vulns bundled in npm 10
# (GHSA-r6q2-hw4h-h46w, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx,
# GHSA-34x7-hfp2-rc4v, GHSA-qffp-2rhf-9h96).
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends \
        build-essential \
        git \
        nodejs=22.22.1-1nodesource1 \
        vim-tiny \
        nano \
        micro \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@11.12.1

# Global npm packages — pinned for reproducibility.
# tar + @hono/node-server: transitive vuln fixes
#   (GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256, GHSA-8qq5-rm4j-mr97,
#    GHSA-r6q2-hw4h-h46w, GHSA-34x7-hfp2-rc4v, GHSA-83g3-92jg-28cx,
#    GHSA-wc8c-qw6v-h7f6).
# opencode-ai + @openai/codex + crush: agent CLIs.
# pyright + typescript-language-server + ...: Language Server Protocol (LSP) servers
#   for agent code intelligence.
RUN npm install -g \
        tar@7.5.11 \
        @hono/node-server@1.19.11 \
        opencode-ai@1.2.18 \
        @openai/codex@0.117.0 \
        @github/copilot@1.0.16 \ \
        @charmland/crush@0.57.0 \
        pyright@1.1.408 \
        typescript@5.7.3 \
        typescript-language-server@5.1.3 \
        bash-language-server@5.4.3 \
        yaml-language-server@1.21.0 \
        vscode-langservers-extracted@4.10.0 \
        dockerfile-language-server-nodejs@0.15.0

# Crush ecosystem Language Server Protocol (LSP)
COPY crush-lsp.js package.json /usr/local/lib/crush-lsp/
RUN cd /usr/local/lib/crush-lsp && npm install --production && \
    ln -s /usr/local/lib/crush-lsp/crush-lsp.js /usr/local/bin/crush-lsp && \
    chmod +x /usr/local/bin/crush-lsp

# Go 1.26.2 + gopls v0.21.1
COPY --from=golang:1.26.2 /usr/local/go /usr/local/go
RUN /usr/local/go/bin/go install golang.org/x/tools/gopls@v0.21.1 && \
    mv /root/go/bin/gopls /usr/local/bin/gopls && \
    rm -rf /root/go

# Rust 1.94.1 + rust-analyzer
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:/usr/local/go/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    --default-toolchain 1.94.1 \
    --profile minimal \
    --component rust-analyzer \
    --component rust-src

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

# Install Claude CLI via native installer (npm method is deprecated)
RUN curl -fsSL https://claude.ai/install.sh | bash \
    && cp /root/.local/bin/claude /usr/local/bin/claude \
    && chmod 755 /usr/local/bin/claude

# uv (Python package/project manager) — pinned for reproducibility.
# uv manages the Python toolchain; no system Python packages are needed.
COPY --from=ghcr.io/astral-sh/uv:0.10.8 /uv /usr/local/bin/uv
ENV UV_PYTHON_INSTALL_DIR="/sandbox/.uv/python"
RUN uv python install 3.13 && \
    ln -s $(uv python find 3.13) /usr/local/bin/python3 && \
    ln -s $(uv python find 3.13) /usr/local/bin/python && \
    uv cache clean

# Final base image
FROM devtools AS final

# Add venvs to PATH -- /sandbox/.venv (writable, user-installed packages)
# takes priority over system paths.
# VIRTUAL_ENV and UV_PYTHON_INSTALL_DIR are also exported in .bashrc
# so that login shell sessions (interactive and exec) see them.
ENV PATH="/sandbox/.venv/bin:/usr/local/cargo/bin:/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin" \
    VIRTUAL_ENV="/sandbox/.venv" \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    CRUSH_DISABLE_PROVIDER_AUTO_UPDATE=1

# Default sandbox network / filesystem policy
COPY policy.yaml /etc/openshell/policy.yaml

# Copy custom skills into the image.
# To add a skill, create a subdirectory under sandboxes/crush/skills/
# with a SKILL.md file (and any supporting files). It will be installed into
# both ~/.claude/skills/ and ~/.agents/skills/ for agent discovery.
COPY skills/ /sandbox/.agents/skills/

# Set up sandbox user home directory
RUN mkdir -p /sandbox/.claude/skills && \
    # Create a writable venv using uv-managed Python 3.13 \
    # Sandbox users can `uv pip install` (or `pip install`) into \
    # this venv without touching the base image layer.\
    uv venv --python 3.13 --seed /sandbox/.venv && \
    uv pip install --python /sandbox/.venv/bin/python cloudpickle && \
    uv cache clean && \
    chown -R sandbox:sandbox /sandbox/.venv && \
    # Minimal shell init files so interactive and non-interactive shells\
    # get a sane PATH and prompt.  Without these, bash sources nothing\
    # under /sandbox and tools like VS Code Remote-SSH may mis-detect\
    # the platform.\
    printf 'export PATH="/sandbox/.venv/bin:/usr/local/cargo/bin:/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin"\nexport VIRTUAL_ENV="/sandbox/.venv"\nexport UV_PYTHON_INSTALL_DIR="/sandbox/.uv/python"\nexport RUSTUP_HOME=/usr/local/rustup\nexport CARGO_HOME=/usr/local/cargo\nexport PS1="\\u@\\h:\\w\\$ "\nexport OPENAI_BASE_URL="https://inference.local/v1"\nexport OPENAI_API_KEY=""\n' \
        > /sandbox/.bashrc && \
    printf '[ -f ~/.bashrc ] && . ~/.bashrc\n' > /sandbox/.profile && \
    chown sandbox:sandbox /sandbox/.bashrc /sandbox/.profile && \
    # Symlink skills into agent discovery directories \
    for skill in /sandbox/.agents/skills/*/; do \
        [ -d "$skill" ] || continue; \
        ln -sf "$skill" "/sandbox/.claude/skills/$(basename "$skill")"; \
    done && \
    # Set up crush coding agent configuration \
    mkdir -p /sandbox/.config/crush && \
    printf '{\n\
  "providers": {\n\
    "inference-local": {\n\
      "id": "inference-local",\n\
      "name": "Inference Local",\n\
      "type": "openai-compat",\n\
      "base_url": "https://inference.local/v1",\n\
      "models": [\n\
        {\n\
          "id": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4",\n\
          "name": "NVIDIA Nemotron-3 Nano",\n\
          "default_max_tokens": 16000\n\
        }\n\
      ]\n\
    }\n\
  },\n\
  "lsp": {\n\
    "python": {\n\
      "command": "pyright-langserver",\n\
      "args": ["--stdio"]\n\
    },\n\
    "typescript": {\n\
      "command": "typescript-language-server",\n\
      "args": ["--stdio"]\n\
    },\n\
    "javascript": {\n\
      "command": "typescript-language-server",\n\
      "args": ["--stdio"]\n\
    },\n\
    "bash": {\n\
      "command": "bash-language-server",\n\
      "args": ["start"]\n\
    },\n\
    "yaml": {\n\
      "command": "yaml-language-server",\n\
      "args": ["--stdio"]\n\
    },\n\
    "dockerfile": {\n\
      "command": "docker-langserver",\n\
      "args": ["--stdio"]\n\
    },\n\
    "json": {\n\
      "command": "vscode-json-language-server",\n\
      "args": ["--stdio"]\n\
    },\n\
    "css": {\n\
      "command": "vscode-css-language-server",\n\
      "args": ["--stdio"]\n\
    },\n\
    "html": {\n\
      "command": "vscode-html-language-server",\n\
      "args": ["--stdio"]\n\
    },\n\
    "go": {\n\
      "command": "gopls"\n\
    },\n\
    "rust": {\n\
      "command": "rust-analyzer"\n\
    },\n\
    "crush": {\n\
      "command": "crush-lsp",\n\
      "args": ["--stdio"]\n\
    },\n\
    "skill": {\n\
      "command": "crush-lsp",\n\
      "args": ["--stdio"]\n\
    }\n\
  }\n\
} \n' > /sandbox/.config/crush/crush.json && \
    chown -R sandbox:sandbox /sandbox/.config /sandbox/.claude /sandbox/.agents /sandbox

USER sandbox

ENTRYPOINT ["/bin/bash"]
