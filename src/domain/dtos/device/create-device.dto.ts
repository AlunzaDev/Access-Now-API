import { readDevice, type DeviceValues } from "./device-fields";

export class CreateDeviceDto {
  private constructor(public readonly values: Required<Pick<DeviceValues, "tipo" | "nombre" | "ip">> & DeviceValues) {}

  static create(body: Record<string, unknown>): [string?, CreateDeviceDto?] {
    const [error, values] = readDevice(body, true);
    if (error) return [error];
    return [undefined, new CreateDeviceDto(values as CreateDeviceDto["values"])];
  }
}
