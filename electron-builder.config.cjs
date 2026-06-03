/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'it.avvocatiemac.anonymcp',
  productName: 'AnonyMCP',
  copyright: 'Copyright © 2026 avvocati-e-mac',

  directories: {
    output: 'release',
    buildResources: 'build-resources'
  },

  extraMetadata: {
    main: 'out/main/index.js'
  },

  files: [
    'out/**/*',
    'dist/**/*',
    'package.json',
    'anonymcp.config.example.json',
    'README.md',
    'LICENSE',
    '!**/*.map',
    '!**/.DS_Store'
  ],

  asar: true,
  asarUnpack: [
    'node_modules/better-sqlite3/**/*',
    'node_modules/bindings/**/*',
    'node_modules/file-uri-to-path/**/*',
    'node_modules/node-gyp-build/**/*'
  ],

  npmRebuild: true,
  buildDependenciesFromSource: false,

  mac: {
    category: 'public.app-category.productivity',
    target: [{ target: 'dmg' }],
    hardenedRuntime: false,
    gatekeeperAssess: false,
    identity: null
  },

  dmg: {
    title: 'AnonyMCP Beta',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    contents: [
      { x: 130, y: 220, type: 'file' },
      { x: 410, y: 220, type: 'link', path: '/Applications' }
    ],
    window: { width: 540, height: 380 }
  },

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    forceCodeSigning: false
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'AnonyMCP',
    artifactName: '${productName}-${version}-windows-${arch}-setup.${ext}'
  },

  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Office',
    artifactName: '${productName}-${version}-linux-x64.${ext}'
  }
}
