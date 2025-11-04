#!/usr/bin/env python3
"""
UCPL to Structured Schema Converter

Converts UCPL compact syntax into token-efficient JSON schema
that LLMs can execute directly without verbose natural language expansion.

This approach reduces token usage by ~75% compared to natural language expansion.
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
import yaml


class UCPLSchemaConverter:
    """Converts UCPL to compact structured schema."""

    def __init__(self):
        self.schema = {
            "format": "ucpl-schema-v1",
            "meta": {},
            "context": {},
            "task": {},
            "constraints": {"must": [], "optional": [], "avoid": []},
            "workflow": None,
            "macros": {},
            "output": {},
        }
        self.current_macro = None
        self.in_workflow = False
        self.workflow_steps = []

    def parse_file(self, file_path: Path) -> Dict:
        """Parse UCPL file into structured schema."""
        content = file_path.read_text(encoding='utf-8')

        # Extract YAML header
        header = self._extract_yaml_header(content)
        if header:
            self.schema["meta"].update(header)

        # Extract UCPL content
        ucpl_content = self._extract_ucpl_content(content)

        # Parse UCPL line by line
        self._parse_ucpl_content(ucpl_content)

        # Clean up empty sections
        self._cleanup_schema()

        return self.schema

    def _extract_yaml_header(self, content: str) -> Optional[Dict]:
        """Extract YAML frontmatter."""
        matches = list(re.finditer(r'^---\s*$', content, re.MULTILINE))
        if len(matches) >= 2:
            yaml_content = content[matches[0].end():matches[1].start()].strip()
            try:
                return yaml.safe_load(yaml_content)
            except yaml.YAMLError:
                return None
        return None

    def _extract_ucpl_content(self, content: str) -> str:
        """Extract UCPL content after YAML header."""
        content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
        matches = list(re.finditer(r'^---\s*$', content, re.MULTILINE))
        if len(matches) >= 2:
            return content[matches[1].end():].strip()
        return content.strip()

    def _parse_ucpl_content(self, content: str):
        """Parse UCPL content line by line."""
        lines = content.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # Skip empty lines and comments
            if not line or line.startswith('#'):
                i += 1
                continue

            # Parse directives
            if line.startswith('@'):
                i = self._parse_directive(lines, i)

            # Parse constraints
            elif line.startswith('!'):
                self.schema["constraints"]["must"].append(line[1:])
                i += 1

            elif line.startswith('?'):
                self.schema["constraints"]["optional"].append(line[1:])
                i += 1

            elif line.startswith('~'):
                self.schema["constraints"]["avoid"].append(line[1:])
                i += 1

            # Parse variable assignment
            elif '> $' in line:
                # Handle output to variable
                i += 1

            else:
                i += 1

    def _parse_directive(self, lines: List[str], index: int) -> int:
        """Parse directive and return next line index."""
        line = lines[index].strip()

        # Role directive
        if line.startswith('@role:'):
            self.schema["context"]["role"] = line.split(':', 1)[1].strip()
            return index + 1

        # Task directive
        elif line.startswith('@task:'):
            task_spec = line.split(':', 1)[1].strip()
            if '|' in task_spec:
                parts = task_spec.split('|')
                self.schema["task"]["primary"] = parts[0]
                self.schema["task"]["focus"] = parts[1:]
            else:
                self.schema["task"]["primary"] = task_spec
            return index + 1

        # Scope directive
        elif line.startswith('@scope:'):
            self.schema["task"]["scope"] = line.split(':', 1)[1].strip()
            return index + 1

        # Principles directive
        elif line.startswith('@principles:'):
            principles = line.split(':', 1)[1].strip()
            self.schema["context"]["principles"] = principles.split('+')
            return index + 1

        # Output directive
        elif line.startswith('@out:'):
            output_spec = line.split(':', 1)[1].strip()
            self.schema["output"]["format"] = output_spec.split('+')
            return index + 1

        # Macro definition
        elif line.startswith('@def '):
            return self._parse_macro_definition(lines, index)

        # Macro usage
        elif line.startswith('@use '):
            macro_name = line.split()[1]
            if '>' in line:
                var = line.split('> $')[1] if '> $' in line else None
                self.workflow_steps.append({
                    "action": "call_macro",
                    "macro": macro_name,
                    "store": f"${var}" if var else None
                })
            return index + 1

        # Workflow
        elif line.startswith('@workflow:'):
            self.in_workflow = True
            return self._parse_workflow(lines, index + 1)

        # Chain (within workflow)
        elif line.startswith('@chain:'):
            return index + 1  # Continue parsing steps

        # Conditional
        elif line.startswith('@if '):
            return self._parse_conditional(lines, index)

        # Loop
        elif line.startswith('@loop:'):
            return self._parse_loop(lines, index)

        # Until
        elif line.startswith('@until '):
            condition = line.split('@until ')[1].strip()
            if self.workflow_steps:
                self.workflow_steps[-1]["until"] = condition
            return index + 1

        # For loop
        elif line.startswith('@for '):
            return self._parse_for_loop(lines, index)

        # Tool invocation
        elif line.startswith('@@'):
            tool_spec = self._parse_tool_invocation(line)
            self.workflow_steps.append(tool_spec)
            return index + 1

        return index + 1

    def _parse_macro_definition(self, lines: List[str], index: int) -> int:
        """Parse macro definition."""
        line = lines[index].strip()
        macro_match = re.match(r'@def\s+(\w+):', line)
        if not macro_match:
            return index + 1

        macro_name = macro_match.group(1)
        self.current_macro = macro_name
        self.schema["macros"][macro_name] = {
            "steps": [],
            "context": {},
            "constraints": {"must": [], "optional": [], "avoid": []}
        }

        # Parse macro body (indented lines)
        i = index + 1
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            # Check if we're still in macro (indented or starts with @)
            if not lines[i].startswith('  ') and not line.startswith('@') and line:
                # Exiting macro
                break

            # Parse macro content
            if line.startswith('@task:'):
                task = line.split(':', 1)[1].strip()
                if '|' in task:
                    parts = task.split('|')
                    self.schema["macros"][macro_name]["context"]["task"] = parts[0]
                    self.schema["macros"][macro_name]["context"]["focus"] = parts[1:]
                else:
                    self.schema["macros"][macro_name]["context"]["task"] = task

            elif line.startswith('!'):
                self.schema["macros"][macro_name]["constraints"]["must"].append(line[1:])

            elif line.startswith('?'):
                self.schema["macros"][macro_name]["constraints"]["optional"].append(line[1:])

            elif line.startswith('~'):
                self.schema["macros"][macro_name]["constraints"]["avoid"].append(line[1:])

            elif line.startswith('@'):
                # Other directives in macro
                if line.startswith('@out:'):
                    self.schema["macros"][macro_name]["output"] = line.split(':', 1)[1].strip().split('+')

            i += 1

        self.current_macro = None
        return i

    def _parse_workflow(self, lines: List[str], index: int) -> int:
        """Parse workflow section."""
        i = index

        while i < len(lines):
            line = lines[i].strip()

            if not line:
                i += 1
                continue

            # Check for workflow end (unindented non-@ line)
            if not lines[i].startswith('  ') and not line.startswith('@'):
                break

            # Parse numbered steps
            step_match = re.match(r'(\d+)\.(.+)', line)
            if step_match:
                step_num = int(step_match.group(1))
                step_content = step_match.group(2).strip()

                step_obj = {"step": step_num}

                # Parse step content
                if step_content.startswith('@use '):
                    macro = step_content.split()[1]
                    step_obj["action"] = "call_macro"
                    step_obj["macro"] = macro

                    if '> $' in step_content:
                        var = step_content.split('> $')[1].strip()
                        step_obj["store"] = f"${var}"

                elif step_content.startswith('@task:'):
                    task = step_content.split(':', 1)[1].strip()
                    step_obj["action"] = task

                    if '> $' in step_content:
                        var = step_content.split('> $')[1].strip()
                        step_obj["store"] = f"${var}"

                elif step_content.startswith('@if '):
                    # Conditional step
                    condition_match = re.match(r'@if\s+(.+?):\s*(.+)', step_content)
                    if condition_match:
                        condition = condition_match.group(1).strip()
                        action = condition_match.group(2).strip()
                        step_obj["condition"] = {"if": condition}
                        step_obj["action"] = action

                elif step_content.startswith('@loop:'):
                    step_obj["action"] = "loop"
                    step_obj["loop"] = {}

                else:
                    step_obj["action"] = step_content

                self.workflow_steps.append(step_obj)

            elif line.startswith('@'):
                i = self._parse_directive(lines, i)
                continue

            i += 1

        # Store workflow
        if self.workflow_steps:
            self.schema["workflow"] = {
                "type": "sequential",
                "steps": self.workflow_steps
            }

        return i

    def _parse_conditional(self, lines: List[str], index: int) -> int:
        """Parse conditional statement."""
        line = lines[index].strip()
        condition_match = re.match(r'@if\s+(.+?):\s*(.+)', line)

        if condition_match:
            condition = condition_match.group(1).strip()
            action = condition_match.group(2).strip()

            step = {
                "condition": {"if": condition},
                "action": action
            }
            self.workflow_steps.append(step)

        return index + 1

    def _parse_loop(self, lines: List[str], index: int) -> int:
        """Parse loop statement."""
        loop_step = {
            "action": "loop",
            "loop": {"steps": []}
        }
        self.workflow_steps.append(loop_step)
        return index + 1

    def _parse_for_loop(self, lines: List[str], index: int) -> int:
        """Parse for loop."""
        line = lines[index].strip()
        for_match = re.match(r'@for\s+(\$\w+)\s+in\s+(\$\w+):', line)

        if for_match:
            loop_var = for_match.group(1)
            iterable = for_match.group(2)

            loop_step = {
                "action": "for_each",
                "variable": loop_var,
                "iterable": iterable,
                "steps": []
            }
            self.workflow_steps.append(loop_step)

        return index + 1

    def _parse_tool_invocation(self, line: str) -> Dict:
        """Parse tool invocation (@@)."""
        tool_match = re.match(r'@@(\w+):(\w+)(?:\[(.+?)\])?', line)

        if tool_match:
            category = tool_match.group(1)
            subcategory = tool_match.group(2)
            params_str = tool_match.group(3)

            tool_spec = {
                "action": "invoke_tool",
                "tool": {
                    "category": category,
                    "subcategory": subcategory
                }
            }

            # Parse parameters
            if params_str:
                params = {}
                for param in params_str.split(','):
                    if '=' in param:
                        key, value = param.split('=', 1)
                        params[key.strip()] = value.strip()
                tool_spec["tool"]["parameters"] = params

            return tool_spec

        return {"action": "unknown"}

    def _cleanup_schema(self):
        """Remove empty sections from schema."""
        # Remove empty dictionaries and lists
        for key in list(self.schema.keys()):
            if isinstance(self.schema[key], dict) and not self.schema[key]:
                del self.schema[key]
            elif isinstance(self.schema[key], list) and not self.schema[key]:
                del self.schema[key]

        # Clean up constraints
        if "constraints" in self.schema:
            if not any(self.schema["constraints"].values()):
                del self.schema["constraints"]

    def to_json(self, indent: int = 2) -> str:
        """Convert schema to JSON string."""
        return json.dumps(self.schema, indent=indent)

    def estimate_tokens(self) -> int:
        """Estimate token count of JSON schema."""
        json_str = self.to_json(indent=None)  # Compact form
        # Approximate: 1 token ≈ 4 characters
        return len(json_str) // 4


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python ucpl_to_schema.py <ucpl_file> [--output json|compact]")
        print("\nConverts UCPL to token-efficient structured schema.")
        print("\nOptions:")
        print("  --output json     Pretty-printed JSON (default)")
        print("  --output compact  Compact JSON (minimal whitespace)")
        sys.exit(1)

    ucpl_file = Path(sys.argv[1])
    output_format = "json"

    if len(sys.argv) > 2 and sys.argv[2] == "--output":
        output_format = sys.argv[3] if len(sys.argv) > 3 else "json"

    if not ucpl_file.exists():
        print(f"Error: File not found: {ucpl_file}")
        sys.exit(1)

    # Convert UCPL to schema
    converter = UCPLSchemaConverter()
    schema = converter.parse_file(ucpl_file)

    # Output
    if output_format == "compact":
        print(json.dumps(schema, separators=(',', ':')))
    else:
        print(json.dumps(schema, indent=2))

    # Token estimate
    token_estimate = converter.estimate_tokens()
    print(f"\n# Estimated tokens: ~{token_estimate}", file=sys.stderr)


if __name__ == "__main__":
    main()
