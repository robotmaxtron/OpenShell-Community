# Crush Sandbox

The OpenShell sandbox image pre-configured with the [Crush](https://github.com/charmbracelet/crush) coding agent.

## What's Included

| Category         | Tools                                                                                  |
|------------------|----------------------------------------------------------------------------------------|
| OS               | Ubuntu 24.04                                                                           |
| Languages        | `python3` (3.13), `node` (22.22.1), `go` (1.26.2), `rust` (1.94.1)                     |
| Package managers | `npm` (11.12.1), `uv` (0.10.8), `pip`                                                  |
| Coding agents    | `claude`, `opencode`, `codex`, `copilot`, `crush`                                      |
| Language Servers | `pyright`, `typescript`, `bash`, `yaml`, `json`, `gopls`, `rust-analyzer`, `crush-lsp` |
| Developer        | `gh`, `git`, `vim`, `nano`, `micro`                                                    |
| Networking       | `ping`, `dig`, `nslookup`, `nc`, `traceroute`, `netstat`, `curl`                       |

### Users

| User         | Purpose                                         |
|--------------|-------------------------------------------------|
| `supervisor` | Privileged process management (nologin shell)   |
| `sandbox`    | Unprivileged user for agent workloads (default) |

### Directory Layout

```
/sandbox/                  # Home directory (sandbox user)
  .bashrc, .profile        # Shell init (PATH, VIRTUAL_ENV, UV_PYTHON_INSTALL_DIR)
  .venv/                   # Writable Python venv (pip install, uv pip install)
  .agents/skills/          # Agent skill discovery
  .claude/skills/          # Claude skill discovery (symlinked from .agents/skills)
```

### Skills

The base image ships with the following agent skills:

| Skill          | Description                                                        |
|----------------|--------------------------------------------------------------------|
| `github`       | REST-only GitHub CLI usage guide (GraphQL is blocked in sandboxes) |
| `crush-config` | Built-in skill for configuring providers, LSPs, and MCP servers.   |

## Build

```bash
docker build -t openshell-crush .
```

### Environment

* Nvidia Jetson Thor
* Ubuntu 24.04
* Jetpack 7.1
* Docker 29.4.0

Additional fixes have been implemented from:
 * https://github.com/jetsonhacks/OpenShell-Thor 

#### Running the model
Run the following command to start the model, make sure to replace `$HF_TOKEN` with your Hugging Face token as you'll
need it to download the NVFP4 model checkpoint and the reasoning parser plugin:

```aiignore
docker run --gpus all --ipc=host --ulimit memlock=-1 --ulimit stack=67108864 -it --rm --pull always --runtime=nvidia \ 
--network host -e HF_TOKEN=$HF_TOKEN -e VLLM_USE_FLASHINFER_MOE_FP4=1 -e VLLM_FLASHIHINFER_MOE_BACKEND=throughput \
-v $HOME/.cache/huggingface:/root/.cache/huggingface nvcr.io/nvidia/vllm:26.03-py3 bash -c "wget -q -O /tmp/nano_v3_reasoning_parser.py \
--header=\"Authorization: Bearer $HF_TOKEN\" \
https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4/resolve/main/nano_v3_reasoning_parser.py \
&& vllm serve nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 \
--gpu-memory-utilization 0.8 \
--trust-remote-code \
--enable-auto-tool-choice \
--tool-call-parser qwen3_coder \
--reasoning-parser-plugin /tmp/nano_v3_reasoning_parser.py \
--reasoning-parser nano_v3 \
--kv-cache-dtype fp8"
```

#### OpenShell Environment
Create the provider and inference to expose the running model.
```aiignore
openshell provider create --name vllm-local --type openai --credential OPENAI_API_KEY=dummy 
--config OPENAI_BASE_URL=http://host.openshell.internal:8000

openshell inference set --provider vllm-local --model nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4

Gateway inference configured:

  Route: inference.local
  Provider: vllm-local
  Model: nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4
  Version: 1
  Timeout: 60s (default)
  Validated Endpoints:
    - http://host.openshell.internal:8000/v1/chat/completions (openai_chat_completions)
```

From the OpenShell-Community repo, create the sandbox and configure it to use the local inference route. We'll give it a
name too. 
```aiignore
openshell sb create --name crush --provider vllm-local --from sandboxes/crush/
```