# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |
| < 2.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in LingFlow AI, please report it responsibly:

1. Open a [GitHub issue](https://github.com/dilitS/LinkFlowAI/issues) titled "Security report" **without** exploit details, and ask
   for a private channel; details are then exchanged privately
2. Include a description of the impact, steps to reproduce and affected versions once in private
3. Allow reasonable time for a fix before public disclosure

This is a volunteer open-source project; response times are best effort.


## Security Considerations

- API keys are stored in `chrome.storage.local` with `TRUSTED_CONTEXTS` access level
- Content scripts do not have direct access to API keys and run only when the user invokes LingFlow on a page (or opts into the selection button)
- All inter-script messages are validated against a schema with size limits
- The extension requests minimal permissions
- No remote code execution — all code is bundled locally
