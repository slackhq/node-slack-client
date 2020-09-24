module.exports = {
  rules: {
    // The rules below are ESLint equivalents for the old TSLint rules in tslint.json

    // Quotemark rule taken care of by Prettier

    // Matches no-dynamic-delete rule
    '@typescript-eslint/no-dynamic-delete': 'error',
    // matches the await-promise rule
    '@typescript-eslint/await-thenable': 'error',
    // matches interface-over-type-literal rule
    '@typescript-eslint/consistent-type-definitions': 'error',
    // matches member-access rule
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      {
        accessibility: 'explicit',
        overrides: {
          constructors: 'no-public',
        },
      },
    ],

    // matches no-require-imports
    '@typescript-eslint/no-require-imports': 'error',

    // matches no-this-assignment
    '@typescript-eslint/no-this-alias': 'error',
    // matches no-unused-expression
    '@typescript-eslint/no-unused-expressions': 'error',
    // matches no-var-requires
    '@typescript-eslint/no-var-requires': 'error',

    // REVIEW: This raised errors in a couple of the files. To view these errors, its value from 'warn' to 'error'
    '@typescript-eslint/explicit-function-return-type': 'warn',
    // matches typedef-whitespace
    '@typescript-eslint/type-annotation-spacing': 'error',
    // whitespace rule is taken care of by prettier
    // max-line-length is matched by Prettier
  },
};
