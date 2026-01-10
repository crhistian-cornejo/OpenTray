# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-10

### Added

- Permission popup window for handling OpenCode permission requests
- Custom tray icon with "OTRAY" branding and `</>` code symbol
- Platform-specific tray icons (monochrome template for macOS, color for Windows)
- LSUIElement support for macOS (menubar-only app, no Dock icon)
- Selection mode for bulk operations on sessions
- Improved instance discovery with aggressive initial retry (3 attempts, 2s intervals)

### Changed

- Reduced instance discovery interval from 120s to 10s for faster detection
- Improved CI/CD workflows with multi-platform builds and Clippy linting
- Separated macOS and Windows release builds for better maintainability
- Updated production config with DMG customization and NSIS settings
- Added CSP security headers for production builds

### Fixed

- Clippy warnings in Rust code
- Fixed tray icon display on both macOS and Windows platforms

## [0.1.0] - 2026-01-10

### Added

- Initial release
- System tray / menubar app for macOS and Windows
- Auto-discovery of OpenCode instances running locally
- Real-time session monitoring with status indicators
- Chat interface with streaming responses
- Session management (create, archive, delete)
- Diff viewer for code changes
- TODO tracking from sessions
- Native notifications when AI completes tasks
- Spotlight-style sliding panel on macOS
- Auto-update support with signed releases
- Cross-platform support (macOS Apple Silicon, macOS Intel, Windows)
