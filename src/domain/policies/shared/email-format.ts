// "texto@dominio.ext" without spaces; allows "+" and long domains (docs/contrato-api.md).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value: unknown): value is string => typeof value === "string" && EMAIL_REGEX.test(value);
