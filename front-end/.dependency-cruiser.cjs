// R1: imports only point inward. domain <- streams <- services <- components
// (components = src/app/chat/**, src/app/app.ts). Never weaken these rules to make a check pass.
const COMPONENTS = '^src/app/(chat/|app\\.ts$)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'R1-domain-is-pure',
      comment: 'R1: src/app/domain never imports rxjs, ws or Angular.',
      severity: 'error',
      from: { path: '^src/app/domain/' },
      to: { path: 'node_modules/(rxjs|ws|@angular)/' },
    },
    {
      name: 'R1-domain-inward-only',
      comment: 'R1: domain imports nothing from streams, services or components.',
      severity: 'error',
      from: { path: '^src/app/domain/' },
      to: { path: '^src/app/(streams|services|chat)/|^src/app/app\\.ts$' },
    },
    {
      name: 'R1-streams-inward-only',
      comment: 'R1: streams import only domain (never services or components).',
      severity: 'error',
      from: { path: '^src/app/streams/' },
      to: { path: '^src/app/(services|chat)/|^src/app/app\\.ts$' },
    },
    {
      name: 'R1-services-inward-only',
      comment: 'R1: services import domain and streams, never components.',
      severity: 'error',
      from: { path: '^src/app/services/' },
      to: { path: COMPONENTS },
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
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
