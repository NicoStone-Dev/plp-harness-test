// Architecture rules: see ../AGENTS.md and ../docs/architecture.md.
// Never disable these rules (no eslint-disable comments, no weakening) to make a check pass.
import js from '@eslint/js';
import rxjs from 'eslint-plugin-rxjs-x';
import tseslint from 'typescript-eslint';

/** R7: time operators belong in streams/ as pure functions with a marble test. */
const TIME_OPERATORS = [
  'debounce', 'debounceTime', 'throttle', 'throttleTime', 'audit', 'auditTime',
  'sample', 'sampleTime', 'delay', 'delayWhen', 'timer', 'interval', 'timeout',
  'timeoutWith', 'bufferTime', 'windowTime',
];

const R4_SUBSCRIBE = {
  selector: "CallExpression[callee.property.name='subscribe']",
  message: 'R4: .subscribe() is only allowed in src/server.ts. Return the Observable and let server.ts subscribe.',
};
const R3_EXPORTED_SUBJECT = {
  selector:
    "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > NewExpression[callee.name=/Subject$/]",
  message: 'R3: Subjects are private. Never export a Subject; export an Observable (subject$.asObservable()) instead.',
};
const R3_SUBJECT_IN_INTERFACE = {
  selector: "TSPropertySignature TSTypeReference[typeName.name=/^(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)$/]",
  message: 'R3: Subjects are private. Expose an Observable and a method instead of a Subject in a public type.',
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'rxjs-x': rxjs },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: {
      // R3: Subjects are private, never exported or public.
      'rxjs-x/no-exposed-subjects': ['error', { allowProtected: false }],
      // R5: no nested subscribe.
      'rxjs-x/no-nested-subscribe': 'error',
      'rxjs-x/no-subscribe-in-pipe': 'error',
      // R9: Observable names end in $.
      'rxjs-x/finnish': [
        'error',
        { functions: false, methods: false, parameters: true, properties: true, variables: true, objects: true },
      ],
      'rxjs-x/no-ignored-subscription': 'off',
      'no-restricted-syntax': ['error', R4_SUBSCRIBE, R3_EXPORTED_SUBJECT, R3_SUBJECT_IN_INTERFACE],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'rxjs', importNames: TIME_OPERATORS, message: 'R7: time logic lives in src/streams/ as a pure function with a marble test.' },
            { name: 'rxjs/operators', message: "Import operators from 'rxjs'." },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'R7: use an RxJS time operator inside src/streams/ (marble-testable).' },
        { name: 'setInterval', message: 'R7: use an RxJS time operator inside src/streams/ (marble-testable).' },
      ],
    },
  },
  // R1: domain is pure — no rxjs, no ws, no outer layers.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['rxjs', 'rxjs/*'], message: 'R1: domain never imports rxjs.' },
            { group: ['ws'], message: 'R1: domain never imports ws.' },
            { group: ['../streams/*', '../server*', '**/streams/**'], message: 'R1: domain must not import outer layers.' },
          ],
        },
      ],
    },
  },
  // R1: streams may import domain, never server.ts.
  {
    files: ['src/streams/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['../server*'], message: 'R1: streams must not import server.ts.' }],
        },
      ],
      'no-restricted-globals': 'off',
    },
  },
  // R4: the one place allowed to subscribe.
  {
    files: ['src/server.ts'],
    rules: { 'no-restricted-syntax': ['error', R3_EXPORTED_SUBJECT, R3_SUBJECT_IN_INTERFACE] },
  },
  {
    files: ['**/*.spec.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  {
    files: ['.dependency-cruiser.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable' } },
  },
);
