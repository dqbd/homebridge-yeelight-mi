import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
  Characteristic,
  WithUUID,
} from "homebridge"

import { YeelightMiHomebridgePlatform } from "./platform"
import { transform } from "./utils/math"
import { Device, YeelightCommandList } from "./yeelight/device"
import { DiscoverDevice } from "./yeelight/discover"

type CharacteristicConstructor = WithUUID<{ new (): Characteristic }>
type YeelightGetter = {
  args: YeelightCommandList["get_prop"]
  handler: (values: string[]) => CharacteristicValue
}
type YeelightSetter = (
  value: CharacteristicValue
) => Promise<CharacteristicValue>

export class YeelightMiPlatformAccessory {
  private lightbulb: Service
  private moonlight?: Service
  private device: Device

  constructor(
    private readonly platform: YeelightMiHomebridgePlatform,
    private readonly accessory: PlatformAccessory<DiscoverDevice>
  ) {
    this.platform.log.info(
      "Supported capabilities:",
      accessory.context.support.join(", ")
    )

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "yeelight")
      .setCharacteristic(
        this.platform.Characteristic.Model,
        accessory.context.model
      )
      .setCharacteristic(
        this.platform.Characteristic.Identifier,
        accessory.context.id
      )

    this.lightbulb =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb)

    this.moonlight =
      accessory.context.model === "ceiling5"
        ? this.accessory.getService(this.platform.Service.Switch) ||
          this.accessory.addService(this.platform.Service.Switch)
        : undefined

    this.device = new Device(
      this.platform.log,
      accessory.context.host,
      accessory.context.port
    )

    this.bindCharacteristic(
      this.lightbulb,
      this.platform.Characteristic.On,
      this.getPower,
      this.setPower
    )

    this.bindCharacteristic(
      this.lightbulb,
      this.platform.Characteristic.Brightness,
      this.getBrightness,
      this.setBrightness
    )

    this.bindCharacteristic(
      this.lightbulb,
      this.platform.Characteristic.ColorTemperature,
      this.getColorTemperature,
      this.setColorTemperature
    )

    if (this.moonlight) {
      this.bindCharacteristic(
        this.moonlight,
        this.platform.Characteristic.On,
        this.getActiveMode,
        this.setActiveMode
      )
    }

    if (accessory.context.support.includes("set_rgb")) {
      this.bindCharacteristic(
        this.lightbulb,
        this.platform.Characteristic.Hue,
        this.getHue,
        this.setHue
      )

      this.bindCharacteristic(
        this.lightbulb,
        this.platform.Characteristic.Saturation,
        this.getSaturation,
        this.setSaturation
      )
    }

    this.device.connect().then(() => {
      this.device.on("notification", (value) => {
        if (!value) return

        this.getUpdateCharacteristic(
          this.lightbulb,
          this.platform.Characteristic.Brightness,
          this.getBrightness
        )(value)

        this.getUpdateCharacteristic(
          this.lightbulb,
          this.platform.Characteristic.On,
          this.getPower
        )(value)

        this.getUpdateCharacteristic(
          this.lightbulb,
          this.platform.Characteristic.Brightness,
          this.getBrightness
        )(value)

        this.getUpdateCharacteristic(
          this.lightbulb,
          this.platform.Characteristic.ColorTemperature,
          this.getColorTemperature
        )(value)

        if (this.moonlight) {
          this.getUpdateCharacteristic(
            this.moonlight,
            this.platform.Characteristic.On,
            this.getActiveMode
          )(value)
        }

        if (accessory.context.support.includes("set_rgb")) {
          this.getUpdateCharacteristic(
            this.lightbulb,
            this.platform.Characteristic.Hue,
            this.getHue
          )(value)

          this.getUpdateCharacteristic(
            this.lightbulb,
            this.platform.Characteristic.Saturation,
            this.getSaturation
          )(value)
        }
      })
    })
  }

  private bindCharacteristic(
    service: Service,
    characteristic: CharacteristicConstructor,
    getter: YeelightGetter,
    setter: YeelightSetter
  ) {
    service
      .getCharacteristic(characteristic)
      .on("get", async (callback: CharacteristicGetCallback) => {
        try {
          await this.device.connect()
          const response = await this.device.command("get_prop", getter.args)
          callback(null, await getter.handler(response))
        } catch (err) {
          this.platform.log.error(err)
          callback(err)
        }
      })
      .on(
        "set",
        async (
          value: CharacteristicValue,
          callback: CharacteristicSetCallback
        ) => {
          try {
            await this.device.connect()
            callback(null, await setter(value))
          } catch (err) {
            this.platform.log.error(err)
            callback(err)
          }
        }
      )
  }

  private getUpdateCharacteristic(
    service: Service,
    characteristic: CharacteristicConstructor,
    getter: YeelightGetter
  ) {
    return (value: { [key: string]: any }) => {
      const values = getter.args.map((key) => value?.[key] ?? "")
      const isMatching = values.some((item) => Boolean(item))

      if (isMatching)
        service.updateCharacteristic(characteristic, getter.handler(values))
    }
  }

  getColorTemperature: YeelightGetter = {
    args: ["ct"],
    handler: ([ct]) => transform(Number(ct), [2700, 5700], [500, 140]),
  }

  setColorTemperature = async (value: CharacteristicValue) => {
    await this.device.command("set_ct_abx", [
      transform(value as number, [140, 500], [5700, 2700]),
      "smooth",
      500,
    ])

    return value
  }

  getPower: YeelightGetter = {
    args: ["power"],
    handler: ([power]) => power === "on",
  }

  setPower = async (value: CharacteristicValue) => {
    await this.device.command("set_power", [(value as boolean) ? "on" : "off"])
    return value
  }

  getBrightness: YeelightGetter = {
    args: ["bright"],
    handler: ([bright]) => Number(bright),
  }

  setBrightness = async (value: CharacteristicValue) => {
    await this.device.command("set_bright", [value as number, "smooth", 500])
    return value
  }

  getActiveMode: YeelightGetter = {
    args: ["active_mode"],
    handler: ([active_mode]) => active_mode === "0",
  }

  setActiveMode = async (value: CharacteristicValue) => {
    await this.device.command("set_power", ["on", "smooth", 500, value ? 1 : 5])
    return value
  }

  getHue: YeelightGetter = {
    args: ["hue"],
    handler: ([hue]) => Number(hue),
  }

  setHue = async (value: CharacteristicValue) => {
    await this.device.command("set_hsv", [
      this.lightbulb.getCharacteristic(this.platform.Characteristic.Hue)
        .value as number,
      value as number,
      "smooth",
      500,
    ])
    return value
  }

  getSaturation: YeelightGetter = {
    args: ["sat"],
    handler: ([sat]) => Number(sat),
  }

  setSaturation = async (value: CharacteristicValue) => {
    await this.device.command("set_hsv", [
      value as number,
      this.lightbulb.getCharacteristic(this.platform.Characteristic.Saturation)
        .value as number,
      "smooth",
      500,
    ])
    return value
  }
}
