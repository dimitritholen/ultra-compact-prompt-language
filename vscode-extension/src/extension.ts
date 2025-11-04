import * as vscode from 'vscode';

/**
 * UCPL VS Code Extension
 * Provides language support for Ultra-Compact Prompt Language
 */

// UCPL vocabulary constants to avoid magic strings
const UCPL_ROLES = ['dev', 'audit', 'teach', 'edit', 'analyze', 'debug', 'design', 'translate'] as const;
const UCPL_TASKS = ['fix', 'explain', 'refactor', 'review', 'summarize', 'generate', 'test', 'optimize', 'doc', 'compare'] as const;
const UCPL_OUTPUT_FORMATS = ['code', 'bullets', 'table', 'json', 'yaml', 'steps', 'diagram', 'prose'] as const;
const UCPL_MODIFIERS = ['concise', 'formal', 'beginner', 'expert', 'secure', 'fast', 'minimal'] as const;

// Tool invocation definitions
const UCPL_TOOLS = [
    { label: 'search:web', detail: 'Web search', doc: 'Search the web for information with optional filters' },
    { label: 'search:code', detail: 'Code search', doc: 'Search code patterns in files' },
    { label: 'think:deep', detail: 'Deep reasoning', doc: 'Use deep reasoning tools for complex analysis' },
    { label: 'fetch:url', detail: 'Fetch URL', doc: 'Retrieve content from a URL' },
    { label: 'read:files', detail: 'Read files', doc: 'Read file contents with pattern matching' },
    { label: 'write:files', detail: 'Write files', doc: 'Write content to files' },
    { label: 'execute:shell', detail: 'Execute shell', doc: 'Run shell commands with timeout support' },
    { label: 'memory:save', detail: 'Save to memory', doc: 'Persist data to memory with key-value storage' },
    { label: 'memory:load', detail: 'Load from memory', doc: 'Retrieve saved data from memory' }
] as const;

// Directive documentation
const DIRECTIVE_DOCS: Readonly<Record<string, string>> = {
    '@role': '**Role Directive**\n\nDefines the LLM persona/role.\n\n**Values**: `dev`, `audit`, `teach`, `edit`, `analyze`, `debug`, `design`, `translate`\n\n[UCPL Documentation](https://github.com/yourusername/ultra-compact-prompt-language)',
    '@task': '**Task Directive**\n\nSpecifies the primary task with optional modifiers.\n\n**Syntax**: `@task:name|modifier|modifier`\n\n**Common tasks**: `fix`, `explain`, `refactor`, `review`, `summarize`',
    '@scope': '**Scope Directive**\n\nLimits work to specific modules or files.\n\n**Example**: `@scope:auth_module`',
    '@out': '**Output Directive**\n\nDefines output format.\n\n**Values**: `code`, `bullets`, `table`, `json`, `yaml`, `steps`, `diagram`, `prose`',
    '@principles': '**Principles Directive**\n\nDefines guiding principles for the task.\n\n**Example**: `@principles:DRY+SOLID`',
    '@def': '**Macro Definition**\n\nDefines a reusable macro.\n\n**Syntax**: `@def macro_name:`\n\nMacros can be invoked with `@use macro_name`',
    '@use': '**Macro Usage**\n\nExecutes a defined macro.\n\n**Syntax**: `@use macro_name`\n\nCan pipe output: `@use macro_name > $result`',
    '@workflow': '**Workflow Directive**\n\nDefines a multi-step workflow.\n\n**Usually contains**: `@chain` for sequential steps',
    '@chain': '**Chain Directive**\n\nSequential execution of steps.\n\n**Example**:\n```\n@chain:\n  1.@task:step_one\n  2.@task:step_two\n```',
    '@if': '**Conditional**\n\nConditional execution.\n\n**Syntax**: `@if condition: action`\n\nSupports `@elif` and `@else`',
    '@elif': '**Else If Conditional**\n\nAlternative condition in conditional block.\n\n**Syntax**: `@elif condition: action`',
    '@else': '**Else Branch**\n\nDefault branch in conditional.\n\n**Syntax**: `@else: action`',
    '@loop': '**Loop**\n\nRepeat until condition.\n\n**Syntax**: `@loop: @until condition`'
};

/**
 * Activates the UCPL extension
 * Registers completion and hover providers for UCPL language support
 *
 * @param context - Extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('UCPL extension is now active');

    // Register completion provider with trigger characters
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'ucpl',
        {
            provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position
            ): vscode.CompletionItem[] {
                try {
                    const line = document.lineAt(position).text;
                    const linePrefix = line.substring(0, position.character);

                    // Directive completions after @
                    if (linePrefix.endsWith('@')) {
                        return getDirectiveCompletions();
                    }

                    // Role completions after @role:
                    if (linePrefix.match(/@role:$/)) {
                        return getRoleCompletions();
                    }

                    // Task completions after @task:
                    if (linePrefix.match(/@task:$/)) {
                        return getTaskCompletions();
                    }

                    // Modifier completions after pipe in task
                    if (linePrefix.match(/@task:[^|]+\|$/)) {
                        return getModifierCompletions();
                    }

                    // Output format completions after @out:
                    if (linePrefix.match(/@out:$/)) {
                        return getOutputCompletions();
                    }

                    // Tool invocations after @@
                    if (linePrefix.match(/@@$/)) {
                        return getToolCompletions();
                    }

                    return [];
                } catch (error) {
                    console.error('Error providing completions:', error);
                    return [];
                }
            }
        },
        '@', ':', '|' // Trigger characters
    );

    // Register hover provider for documentation tooltips
    const hoverProvider = vscode.languages.registerHoverProvider('ucpl', {
        provideHover(
            document: vscode.TextDocument,
            position: vscode.Position
        ): vscode.Hover | undefined {
            try {
                const range = document.getWordRangeAtPosition(position, /@\w+/);
                if (!range) {
                    return undefined;
                }

                const word = document.getText(range);
                const hoverText = getHoverDocumentation(word);

                if (hoverText) {
                    const markdown = new vscode.MarkdownString(hoverText);
                    markdown.isTrusted = true; // Allow command links
                    return new vscode.Hover(markdown);
                }

                return undefined;
            } catch (error) {
                console.error('Error providing hover:', error);
                return undefined;
            }
        }
    });

    // Register all providers for proper disposal
    context.subscriptions.push(completionProvider, hoverProvider);
}

/**
 * Deactivates the extension
 * Called when the extension is deactivated
 */
export function deactivate(): void {
    // Cleanup is handled automatically via subscriptions
}

// Completion helper functions

/**
 * Returns completion items for UCPL directives
 * @returns Array of completion items for directives like @role, @task, etc.
 */
function getDirectiveCompletions(): vscode.CompletionItem[] {
    const directives = [
        { label: 'role', detail: 'Define LLM persona', kind: vscode.CompletionItemKind.Keyword },
        { label: 'task', detail: 'Primary task specification', kind: vscode.CompletionItemKind.Keyword },
        { label: 'scope', detail: 'Limit work to specific area', kind: vscode.CompletionItemKind.Keyword },
        { label: 'out', detail: 'Output format', kind: vscode.CompletionItemKind.Keyword },
        { label: 'principles', detail: 'Guiding principles', kind: vscode.CompletionItemKind.Keyword },
        { label: 'add', detail: 'Add features', kind: vscode.CompletionItemKind.Keyword },
        { label: 'def', detail: 'Define reusable macro', kind: vscode.CompletionItemKind.Keyword },
        { label: 'workflow', detail: 'Multi-step workflow', kind: vscode.CompletionItemKind.Keyword },
        { label: 'chain', detail: 'Sequential execution', kind: vscode.CompletionItemKind.Keyword },
        { label: 'if', detail: 'Conditional logic', kind: vscode.CompletionItemKind.Keyword },
        { label: 'elif', detail: 'Else if condition', kind: vscode.CompletionItemKind.Keyword },
        { label: 'else', detail: 'Else branch', kind: vscode.CompletionItemKind.Keyword },
        { label: 'loop', detail: 'Repeat until condition', kind: vscode.CompletionItemKind.Keyword },
        { label: 'until', detail: 'Loop termination condition', kind: vscode.CompletionItemKind.Keyword },
        { label: 'use', detail: 'Execute macro', kind: vscode.CompletionItemKind.Keyword }
    ];

    return directives.map(d => {
        const item = new vscode.CompletionItem(d.label, d.kind);
        item.detail = d.detail;
        return item;
    });
}

/**
 * Returns completion items for UCPL roles
 * @returns Array of completion items for role values
 */
function getRoleCompletions(): vscode.CompletionItem[] {
    return UCPL_ROLES.map(role => {
        const item = new vscode.CompletionItem(role, vscode.CompletionItemKind.EnumMember);
        item.detail = `Role: ${role}`;
        return item;
    });
}

/**
 * Returns completion items for UCPL tasks
 * @returns Array of completion items for task values
 */
function getTaskCompletions(): vscode.CompletionItem[] {
    return UCPL_TASKS.map(task => {
        const item = new vscode.CompletionItem(task, vscode.CompletionItemKind.EnumMember);
        item.detail = `Task: ${task}`;
        return item;
    });
}

/**
 * Returns completion items for task modifiers
 * @returns Array of completion items for modifier values
 */
function getModifierCompletions(): vscode.CompletionItem[] {
    return UCPL_MODIFIERS.map(modifier => {
        const item = new vscode.CompletionItem(modifier, vscode.CompletionItemKind.EnumMember);
        item.detail = `Modifier: ${modifier}`;
        return item;
    });
}

/**
 * Returns completion items for output formats
 * @returns Array of completion items for output format values
 */
function getOutputCompletions(): vscode.CompletionItem[] {
    return UCPL_OUTPUT_FORMATS.map(format => {
        const item = new vscode.CompletionItem(format, vscode.CompletionItemKind.EnumMember);
        item.detail = `Output format: ${format}`;
        return item;
    });
}

/**
 * Returns completion items for tool invocations
 * @returns Array of completion items for @@tool:category syntax
 */
function getToolCompletions(): vscode.CompletionItem[] {
    return UCPL_TOOLS.map(tool => {
        const item = new vscode.CompletionItem(tool.label, vscode.CompletionItemKind.Method);
        item.detail = tool.detail;
        item.documentation = new vscode.MarkdownString(tool.doc);
        return item;
    });
}

/**
 * Returns hover documentation for a directive
 * @param word - The directive word (e.g., '@role', '@task')
 * @returns Markdown documentation string or undefined
 */
function getHoverDocumentation(word: string): string | undefined {
    return DIRECTIVE_DOCS[word];
}
