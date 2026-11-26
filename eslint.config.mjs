import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Layers (docs/arquitectura.md): each one only imports the ones inside it.
const layerRule = (message, layers, packages = []) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [{ group: layers.flatMap((layer) => [`**/${layer}`, `**/${layer}/**`]), message }],
      paths: packages.map((name) => ({ name, message })),
    },
  ],
});

export default defineConfig(
  { ignores: ["dist", "node_modules", "public", "src/generated", "**/*.js", "**/*.mjs"] },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // Output only through config/logger.ts.
      "no-console": "error",
    },
  },
  {
    files: ["**/*.test.ts", "tests/**/*.ts"],
    rules: { "no-console": "off", "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["src/domain/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: layerRule(
      "domain no depende de otras capas ni de Express o Prisma (docs/arquitectura.md).",
      ["application", "infrastructure", "api", "presentation", "generated"],
      ["express", "@prisma/client", "@prisma/adapter-pg", "nodemailer", "jsonwebtoken", "bcryptjs"],
    ),
  },
  {
    files: ["src/application/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: layerRule(
      "application usa las interfaces de domain (repository, ports); la implementación se conecta en presentation/dependencies (docs/arquitectura.md).",
      ["infrastructure", "api", "presentation", "generated"],
      ["express", "@prisma/client", "@prisma/adapter-pg", "nodemailer"],
    ),
  },
  {
    files: ["src/infrastructure/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: layerRule(
      "infrastructure implementa lo que pide domain; no conoce servicios ni rutas (docs/arquitectura.md).",
      ["application", "api", "presentation"],
    ),
  },
  {
    files: ["src/api/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: layerRule(
      "api/middlewares no conoce rutas ni implementaciones; recibe lo que necesita desde presentation/dependencies (docs/arquitectura.md).",
      ["presentation", "infrastructure", "generated"],
    ),
  },
);
