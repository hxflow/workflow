// eslint.config.js — ESLint Flat Config
// 包含黄金原则对应的自定义规则

import js from '@eslint/js'
import ts from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  // ── 基础配置 ──────────────────────────────────────────────
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': ts },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      // ── TypeScript 严格规则 ──────────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',              // GP-009
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowHigherOrderFunctions: true
      }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],

      // ── 黄金原则对应规则 ─────────────────────────────────
      'no-console': 'error',                                       // GP-001
      'no-restricted-syntax': [
        'error',
        {
          // GP-003: 禁止裸 throw new Error
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message: '[GP-003] 使用 AppError 类，不允许 throw new Error(\'...\')。参考 docs/golden-principles.md'
        }
      ],

      // ── 代码质量 ──────────────────────────────────────────
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'no-duplicate-imports': 'error',

      // ── 命名规范（GP-008）────────────────────────────────
      // 注：布尔值 is/has/can 前缀通过 code review 检查，此处不做 lint 强制
      // 因为 lint 规则会产生大量误报（如参数、解构等场景）

      // ── 空 catch 块（GP 附属）───────────────────────────
      'no-empty': ['error', { allowEmptyCatch: false }]
    }
  },

  // ── 测试文件放宽规则 ──────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',    // 测试中允许 any
      'no-console': 'off'                               // 测试中允许 console
    }
  },

  // ── 脚本文件放宽规则 ──────────────────────────────────────
  {
    files: ['scripts/**/*.js'],
    rules: {
      'no-console': 'off'   // 脚本文件是命令行工具，允许 console
    }
  },

  // ── 忽略文件 ──────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js'
    ]
  }
]
