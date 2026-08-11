# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |
| < 2.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in LingFlow AI, please report it responsibly:

1. **Do not** create a public GitHub issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting feature
3. Include a description of the vulnerability, steps to reproduce, and potential impact
4. Allow reasonable time for a fix before public disclosure

We aim to acknowledge reports within 48 hours and provide a fix within 7 days for critical issues.

## Security Considerations

- API keys are stored in `chrome.storage.local` with `TRUSTED_CONTEXTS` access level
- Content scripts do not have direct access to API keys
- All inter-script messages are validated against a schema with size limits
- The extension requests minimal permissions
- No remote code execution — all code is bundled locally
