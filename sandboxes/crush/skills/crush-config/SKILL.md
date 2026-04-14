---
name: crush-config
description: Configure Crush settings including providers, LSPs, MCPs, skills, permissions, and behavior options. Use when the user needs help with crush.json configuration, setting up providers, configuring LSPs, adding MCP servers, or changing Crush behavior.
---

# Crush Configuration

Crush uses JSON configuration files with the following priority (highest to lowest):

1. `.crush.json` (local project configuration)
2. `crush.json` (local project configuration)
3. `$XDG_CONFIG_HOME/crush/crush.json` (global configuration)
4. `$HOME/.config/crush/crush.json` (global configuration)

## Basic Structure

```json
{
  "$schema": "https://charm.sh/crush/schema.json",
  "providers": { ... },
  "lsp": { ... },
  "mcp": { ... },
  "options": { ... }
}
```

## Common Tasks

### Providers
Configure AI providers (OpenAI, Anthropic, local, etc.).
- `type`: `openai`, `openai-compat`, `anthropic`, etc.
- `base_url`: URL for compatible APIs.
- `api_key`: API key or environment variable (e.g., `$MY_KEY`).

### LSPs
Configure Language Server Protocol servers for code intelligence.
- `command`: Path to the LSP binary.
- `args`: Command-line arguments.

### MCP Servers
Add Model Context Protocol servers.
- `type`: `stdio`, `sse`, `http`.
- `command`: Command to run the MCP server.

### Options
- `skills_paths`: Additional directories to search for skills.
- `disabled_skills`: List of skill names to disable.

## Navigation
Use the `crush-config` skill to help users manage these settings via natural language.
