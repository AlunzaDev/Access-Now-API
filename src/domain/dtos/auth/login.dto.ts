export class LoginDto {
  private constructor(
    public readonly correo: string,
    public readonly password: string,
  ) {}

  static create(object: Record<string, unknown>): [string?, LoginDto?] {
    const correo = String(object.correo ?? "").trim().toLowerCase();
    const password = String(object.password ?? "");

    if (!correo) return ["El correo es obligatorio"];
    if (!password) return ["La contraseña es obligatoria"];

    return [undefined, new LoginDto(correo, password)];
  }
}
