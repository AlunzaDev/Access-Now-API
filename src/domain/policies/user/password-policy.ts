// Password rule shared with the dashboard (docs/contrato-api.md, "Reglas de validación").

export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S{8,}$/;

export const PASSWORD_POLICY_MESSAGE =
  "La contraseña debe tener al menos 8 caracteres, sin espacios, con una mayúscula, una minúscula y un número";

export const isValidPassword = (password: unknown): password is string =>
  typeof password === "string" && PASSWORD_POLICY_REGEX.test(password);
