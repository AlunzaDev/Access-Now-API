import { readDevice, type DeviceValues } from "./device-fields";

export class UpdateDeviceDto {
  private constructor(public readonly values: DeviceValues) {}

  static create(body: Record<string, unknown>): [string?, UpdateDeviceDto?] {
    const [error, values] = readDevice(body, false);
    if (error) return [error];
    if (Object.keys(values!).length === 0) return ["No hay campos para actualizar"];
    return [undefined, new UpdateDeviceDto(values!)];
  }
}
