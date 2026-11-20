// Architecture rules: see ../AGENTS.md and ../docs/architecture.md.
// Never disable these rules (no eslint-disable comments, no weakening) to make a check pass.
import js from '@eslint/js';
import angular from 'angular-eslint';
import rxjs from 'eslint-plugin-rxjs-x';
import tseslint from 'typescript-eslint';

/** R7: time operators belong in streams/ as pure functions with a marble test. */
const TIME_OPERATORS = [
  'debounce', 'debounceTime', 'throttle', 'throttleTime', 'audit', 'auditTime',
  'sample', 'sampleTime', 'delay', 'delayWhen', 'timer', 'interval', 'timeout',
  'timeoutWith', 'bufferTime', 'windowTime',
];
const R7_TIME = { name: 'rxjs', importNames: TIME_OPERATORS, message: 'R7: time logic lives in src/app/streams/ as a pure function with a marble test.' };
const R6_TO_SIGNAL = { name: '@angular/core/rxjs-interop', importNames: ['toSignal'], message: 'R6: toSignal is only used in components (src/app/chat/**, src/app/app.ts).' };
const NO_RXJS_OPERATORS = { name: 'rxjs/operators', message: "Import operators from 'rxjs'." };

const R1 = {
  pure: [
    { group: ['rxjs', 'rxjs/*'], message: 'R1: domain never imports rxjs.' },
    { group: ['@angular/*'], message: 'R1: domain never imports Angular.' },
    { group: ['ws'], message: 'R1: domain never imports ws.' },
  ],
  notStreams: { group: ['**/streams/*'], message: 'R1: only services/ and components may import streams/.' },
  notServices: { group: ['**/services/*'], message: 'R1: only components may import services/.' },
  notComponents: { group: ['**/chat/**', '**/app', '../app*', './app*'], message: 'R1: components are the outermost layer; nothing inside imports them.' },
};

const restrict = (paths, patterns = []) => ['error', { paths, patterns }];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.angular/**', 'coverage/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'rxjs-x': rxjs },
    linterOptions: { noInlineConfig: true },
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      // R3: Subjects are private, never exported or public (protected counts as public).
      'rxjs-x/no-exposed-subjects': ['error', { allowProtected: false }],
      // R5: no nested subscribe.
      'rxjs-x/no-nested-subscribe': 'error',
      'rxjs-x/no-subscribe-in-pipe': 'error',
      // R9: Observable names end in $.
      'rxjs-x/finnish': [
        'error',
        { functions: false, methods: false, parameters: true, properties: true, variables: true, objects: true },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // R4: never .subscribe() in the front-end. Use the async pipe or toSignal in a component.
          selector: "CallExpression[callee.property.name='subscribe']",
          message: 'R4: .subscribe() is not allowed in the front-end. Use the async pipe or toSignal in a component.',
        },
        {
          selector: 'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > NewExpression[callee.name=/Subject$/]',
          message: 'R3: Subjects are private. Never export a Subject; export an Observable instead.',
        },
        {
          selector: 'TSPropertySignature TSTypeReference[typeName.name=/^(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)$/]',
          message: 'R3: Subjects are private. Expose an Observable and a method instead of a Subject in a public type.',
        },
        {
          selector: 'PropertyDefinition[accessibility!="private"][key.type!="PrivateIdentifier"] > NewExpression[callee.name=/Subject$/]',
          message: 'R3: Subjects are private. Declare the Subject `private` and expose a method/Observable.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'R7: use an RxJS time operator inside src/app/streams/ (marble-testable).' },
        { name: 'setInterval', message: 'R7: use an RxJS time operator inside src/app/streams/ (marble-testable).' },
      ],
      // Default (main.ts, app.config.ts, app.routes.ts, ...): no toSignal, no time logic.
      'no-restricted-imports': restrict([R7_TIME, R6_TO_SIGNAL, NO_RXJS_OPERATORS]),
    },
  },
  {
    files: ['src/app/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        [R7_TIME, R6_TO_SIGNAL, NO_RXJS_OPERATORS],
        [...R1.pure, R1.notStreams, R1.notServices, R1.notComponents],
      ),
    },
  },
  {
    files: ['src/app/streams/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([R6_TO_SIGNAL, NO_RXJS_OPERATORS], [R1.notServices, R1.notComponents]),
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['src/app/services/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([R7_TIME, R6_TO_SIGNAL, NO_RXJS_OPERATORS], [R1.notComponents]),
    },
  },
  {
    // Components: the only place toSignal is allowed (R6).
    files: ['src/app/chat/**/*.ts', 'src/app/app.ts'],
    rules: { 'no-restricted-imports': restrict([R7_TIME, NO_RXJS_OPERATORS]) },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    linterOptions: { noInlineConfig: true },
  },
);
