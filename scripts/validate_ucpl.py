#!/usr/bin/env python3
"""
UCPL Bootstrappability Validator

Validates that UCPL files are self-describing and can be interpreted by any LLM.
Checks for required headers, version compatibility, and proper formatting.
"""

import sys
import yaml
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import re


class UCPLValidator:
    """Validates UCPL files for bootstrappability."""

    REQUIRED_FIELDS = ["format", "version", "parser"]
    VALID_PARSERS = ["ucpl-standard", "ucpl-minimal", "ucpl-extended", "ucpl-strict"]
    SUPPORTED_VERSIONS = ["1.0", "1.1"]

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []

    def validate_file(self, file_path: Path) -> bool:
        """Validate a single UCPL file. Returns True if valid."""
        self.errors.clear()
        self.warnings.clear()
        self.info.clear()

        if not file_path.exists():
            self.errors.append(f"File not found: {file_path}")
            return False

        content = file_path.read_text(encoding='utf-8')

        # Check for UUIP reference comment
        if not self._check_uuip_comment(content):
            self.warnings.append("Missing UUIP reference comment (<!-- UCPL: Expand with UUIP v1.0 | ... -->)")

        # Extract and validate YAML header
        header = self._extract_yaml_header(content)
        if header is None:
            self.errors.append("No valid YAML header found (must start with '---' and end with '---')")
            return False

        # Validate required fields
        if not self._validate_required_fields(header):
            return False

        # Validate field values
        if not self._validate_field_values(header):
            return False

        # Check optional but recommended fields
        self._check_recommended_fields(header)

        # Validate UCPL content
        ucpl_content = self._extract_ucpl_content(content)
        if not self._validate_ucpl_content(ucpl_content):
            return False

        return len(self.errors) == 0

    def _check_uuip_comment(self, content: str) -> bool:
        """Check for UUIP reference comment at start of file."""
        pattern = r'<!--\s*UCPL:\s*Expand with UUIP\s+v[\d.]+.*?-->'
        return bool(re.search(pattern, content[:200]))

    def _extract_yaml_header(self, content: str) -> Optional[Dict]:
        """Extract YAML frontmatter from content."""
        # Find YAML delimiters
        matches = list(re.finditer(r'^---\s*$', content, re.MULTILINE))

        if len(matches) < 2:
            return None

        # Extract YAML content between first two delimiters
        start = matches[0].end()
        end = matches[1].start()
        yaml_content = content[start:end].strip()

        try:
            return yaml.safe_load(yaml_content)
        except yaml.YAMLError as e:
            self.errors.append(f"Invalid YAML syntax: {e}")
            return None

    def _validate_required_fields(self, header: Dict) -> bool:
        """Validate that all required fields are present."""
        missing = [field for field in self.REQUIRED_FIELDS if field not in header]

        if missing:
            self.errors.append(f"Missing required fields: {', '.join(missing)}")
            return False

        return True

    def _validate_field_values(self, header: Dict) -> bool:
        """Validate field values are correct."""
        valid = True

        # Check format field
        if header.get("format") != "ucpl":
            self.errors.append(f"Invalid format: '{header.get('format')}' (must be 'ucpl')")
            valid = False

        # Check version field
        version = header.get("version")
        if isinstance(version, (int, float)):
            version = str(version)

        if version not in self.SUPPORTED_VERSIONS:
            self.warnings.append(f"Unsupported version: '{version}' (supported: {', '.join(self.SUPPORTED_VERSIONS)})")

        # Check parser field
        parser = header.get("parser")
        if parser not in self.VALID_PARSERS:
            self.warnings.append(f"Unknown parser: '{parser}' (known: {', '.join(self.VALID_PARSERS)})")

        return valid

    def _check_recommended_fields(self, header: Dict):
        """Check for optional but recommended fields."""
        if "description" not in header:
            self.warnings.append("Recommended field missing: 'description'")

        if "spec_url" not in header:
            self.warnings.append("Recommended field missing: 'spec_url' (helps LLMs find UUIP)")

        if "updated" not in header:
            self.info.append("Optional field missing: 'updated' (ISO 8601 date)")

        if "tags" not in header:
            self.info.append("Optional field missing: 'tags' (aids categorization)")

        # Check if strict mode might be appropriate
        if header.get("strict") is None:
            self.info.append("Consider setting 'strict: true' for production prompts")

    def _extract_ucpl_content(self, content: str) -> str:
        """Extract UCPL content after YAML header."""
        matches = list(re.finditer(r'^---\s*$', content, re.MULTILINE))

        if len(matches) < 2:
            return ""

        return content[matches[1].end():].strip()

    def _validate_ucpl_content(self, content: str) -> bool:
        """Basic validation of UCPL syntax."""
        if not content:
            self.errors.append("No UCPL content found after YAML header")
            return False

        # Check for common UCPL patterns
        ucpl_patterns = [
            r'@\w+:',  # Directives
            r'!\w+',   # Constraints
            r'>\s*\w+', # Output operators
        ]

        has_ucpl = any(re.search(pattern, content) for pattern in ucpl_patterns)

        if not has_ucpl:
            self.warnings.append("No UCPL syntax detected (file may be plain text)")

        return True

    def print_results(self, file_path: Path, valid: bool):
        """Print validation results in a human-readable format."""
        status = "✓ VALID" if valid else "✗ INVALID"
        print(f"\n{status}: {file_path}")

        if self.errors:
            print("\n  Errors:")
            for error in self.errors:
                print(f"    ✗ {error}")

        if self.warnings:
            print("\n  Warnings:")
            for warning in self.warnings:
                print(f"    ⚠ {warning}")

        if self.info:
            print("\n  Info:")
            for info_msg in self.info:
                print(f"    ℹ {info_msg}")


def validate_directory(directory: Path) -> Tuple[int, int]:
    """Validate all UCPL files in directory. Returns (valid_count, total_count)."""
    validator = UCPLValidator()

    # Find all .md files that might be UCPL
    ucpl_files = list(directory.rglob("*.md"))

    if not ucpl_files:
        print(f"No .md files found in {directory}")
        return 0, 0

    valid_count = 0
    total_count = 0

    for file_path in ucpl_files:
        # Quick check if file has UCPL header
        content = file_path.read_text(encoding='utf-8')
        if 'format: ucpl' not in content[:500]:
            continue

        total_count += 1
        is_valid = validator.validate_file(file_path)
        validator.print_results(file_path, is_valid)

        if is_valid:
            valid_count += 1

    return valid_count, total_count


def main():
    """Main entry point for CLI usage."""
    if len(sys.argv) < 2:
        print("Usage: python validate_ucpl.py <file_or_directory>")
        print("\nValidates UCPL files for bootstrappability:")
        print("  - Checks required YAML headers")
        print("  - Validates field values")
        print("  - Verifies UUIP references")
        print("  - Checks for recommended fields")
        sys.exit(1)

    path = Path(sys.argv[1])

    if not path.exists():
        print(f"Error: Path does not exist: {path}")
        sys.exit(1)

    if path.is_file():
        validator = UCPLValidator()
        is_valid = validator.validate_file(path)
        validator.print_results(path, is_valid)
        sys.exit(0 if is_valid else 1)

    elif path.is_dir():
        valid_count, total_count = validate_directory(path)

        print(f"\n{'='*60}")
        print(f"Summary: {valid_count}/{total_count} files valid")

        if total_count == 0:
            print("No UCPL files found.")
            sys.exit(0)

        success_rate = (valid_count / total_count) * 100
        print(f"Success rate: {success_rate:.1f}%")

        sys.exit(0 if valid_count == total_count else 1)

    else:
        print(f"Error: Path is neither file nor directory: {path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
