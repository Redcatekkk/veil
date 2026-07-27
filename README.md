# Veil

Veil is a Windows desktop interface for managing a Steam library, browsing a
game catalog, importing manifests, configuring Veil, managing cloud saves, and
applying supported game fixes from one application.

This repository contains the public frontend source for Veil 3.1.0. The private
Rust/Tauri backend, Steam integration components, injected libraries, and
third-party executable resources are intentionally not included.

## Interface

The frontend includes:

- Library management
- Game catalog and search
- Manifest import flows
- DLC selection and management
- Bypass status and controls
- Cloud-save configuration
- Game-fix management
- Veil and Steam settings

## Technology

- React 19
- TypeScript
- Vite 7
- Tauri 2 frontend APIs
- Phosphor Icons

## Local Development

Install the dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Create a production frontend build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The browser development server can render the interface, but actions that call
Tauri commands require Veil's private desktop backend and will not execute in a
standalone browser.

## Project Structure

```text
public/         Static fonts, icons, and images
src/
  components/  Shared interface components
  lib/         Frontend command wrappers and hooks
  pages/       Main application pages and page styles
index.html      Vite entry document
package.json   Scripts and frontend dependencies
vite.config.ts Vite configuration
```

## Public Source Scope

Build artifacts, installed dependencies, environment files, the Tauri backend,
and executable resources are excluded from this repository. This keeps the
public tree focused on the interface shown in Veil releases.
