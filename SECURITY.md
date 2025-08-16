# Security Notes

- LaTeX sources are sent to the SwiftLaTeX service for PDF compilation.
- Only the presence of the SwiftLaTeX token is logged, never its value.
- If the remote service is unreachable the client falls back to a screenshot export.
