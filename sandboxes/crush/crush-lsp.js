#!/usr/bin/env node

const {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  DiagnosticSeverity,
} = require("vscode-languageserver/node");

const { TextDocument } = require("vscode-languageserver-textdocument");
const yaml = require("js-yaml");

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['"', ":", " "],
      },
      hoverProvider: true,
    },
  };
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument) {
  const text = textDocument.getText();
  const diagnostics = [];

  if (textDocument.uri.endsWith("crush.json") || textDocument.uri.endsWith(".crush.json")) {
    try {
      JSON.parse(text);
    } catch (e) {
      const match = e.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(position),
          end: textDocument.positionAt(position + 1),
        },
        message: `Invalid JSON: ${e.message}`,
        source: "crush-lsp",
      });
    }
  } else if (textDocument.uri.endsWith("SKILL.md")) {
    const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        yaml.load(frontmatterMatch[1]);
      } catch (e) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: textDocument.positionAt(e.mark?.position || 0),
            end: textDocument.positionAt((e.mark?.position || 0) + 1),
          },
          message: `Invalid YAML in frontmatter: ${e.message}`,
          source: "crush-lsp",
        });
      }
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const text = document.getText();
  const position = params.position;
  const offset = document.offsetAt(position);

  if (document.uri.endsWith("crush.json") || document.uri.endsWith(".crush.json")) {
    // Basic completions for crush.json
    return [
      { label: "providers", kind: 10, detail: "AI provider configurations" },
      { label: "lsp", kind: 10, detail: "Language Server Protocol configurations" },
      { label: "mcp", kind: 10, detail: "Model Context Protocol configurations" },
      { label: "options", kind: 10, detail: "Global agent options" },
      { label: "$schema", kind: 10, detail: "Configuration schema URL" },
    ];
  } else if (document.uri.endsWith("SKILL.md")) {
    // Basic completions for SKILL.md frontmatter
    const isInsideFrontmatter = offset < (text.indexOf("\n---", 4) || Infinity);
    if (isInsideFrontmatter) {
      return [
        { label: "name", kind: 10, detail: "Unique name of the skill" },
        { label: "description", kind: 10, detail: "Brief description of the skill" },
        { label: "license", kind: 10, detail: "License identifier (e.g. Apache-2.0)" },
        { label: "compatibility", kind: 10, detail: "Environment compatibility notes" },
        { label: "metadata", kind: 10, detail: "Additional key-value metadata" },
      ];
    }
  }

  return [];
});

connection.onCompletionResolve((item) => {
  if (item.label === "providers") {
    item.documentation = "Configure AI providers like OpenAI, Anthropic, or local endpoints.";
  } else if (item.label === "lsp") {
    item.documentation = "Configure Language Servers to give the agent code intelligence.";
  } else if (item.label === "mcp") {
    item.documentation = "Add Model Context Protocol servers for external tool integration.";
  } else if (item.label === "options") {
    item.documentation = "Global settings for UI, TUI, and agent behavior.";
  }
  return item;
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  if (document.uri.endsWith("crush.json") || document.uri.endsWith(".crush.json")) {
    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const wordMatch = text.slice(0, offset).match(/(\w+)$/);
    if (!wordMatch) return null;
    const word = wordMatch[1];

    const docs = {
      providers: "AI provider configurations",
      lsp: "Language Server Protocol configurations",
      mcp: "Model Context Protocol configurations",
      options: "Global agent options",
    };

    if (docs[word]) {
      return {
        contents: {
          kind: "markdown",
          value: `**${word}**\n\n${docs[word]}`,
        },
      };
    }
  }
  return null;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
