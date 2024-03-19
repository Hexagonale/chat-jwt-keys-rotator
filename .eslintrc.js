module.exports = {
    root: true,
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "eslint-config-prettier"],
    plugins: ["@typescript-eslint", "simple-import-sort"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.json",
    },
    rules: {
        "consistent-return": "off",
        "object-curly-newline": "off",
        "no-restricted-syntax": "off",
        "no-continue": "off",
        "no-await-in-loop": "off",
        "no-plusplus": "off",
    },
};
