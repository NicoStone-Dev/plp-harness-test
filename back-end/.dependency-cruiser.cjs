// R1: imports only point inward. domain <- streams <- server.ts
// Never weaken these rules to make a check pass.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'R1-domain-is-pure',
      comment: 'R1: src/domain never imports rxjs or ws.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: 'node_modules/(rxjs|ws)/' },
    },
    {
      name: 'R1-domain-inward-only',
      comment: 'R1: src/domain must not import src/streams or src/server.ts.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(streams/|server\\.ts)' },
    },
    {
      name: 'R1-streams-inward-only',
      comment: 'R1: src/streams must not import src/server.ts.',
      severity: 'error',
      from: { path: '^src/streams/' },
      to: { path: '^src/server\\.ts' },
    },
    {
      name: 'R1-nothing-imports-server',
      comment: 'R1: src/server.ts is the composition root; nothing imports it.',
      severity: 'error',
      from: {},
      to: { path: '^src/server\\.ts' },
    },
    {
      name: 'R1-production-does-not-import-tests',
      severity: 'error',
      from: { pathNot: '\\.spec\\.ts$' },
      to: { path: '\\.spec\\.ts$' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'] },
  },
};
