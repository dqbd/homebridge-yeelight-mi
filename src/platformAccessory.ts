import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from "homebridge"

import { YeelightMiHomebridgePlatform } from "./platform"
import { transform } from "./utils/math"
import { Device } from "./yeelight/device"
import { DiscoverDevice } from "./yeelight/discover"

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

    this.device = new Device(
      this.platform.log,
      accessory.context.host,
      accessory.context.port
    )

    this.lightbulb
      .getCharacteristic(this.platform.Characteristic.On)
      .on("set", this.setPromise(this.setPower))
      .on("get", this.getPromise(this.getPower))

    this.lightbulb
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .on("set", this.setPromise(this.setBrightness))
      .on("get", this.getPromise(this.getBrightness))

    this.lightbulb
      .getCharacteristic(this.platform.Characteristic.ColorTemperature)
      .on("get", this.getPromise(this.getColorTemperature))
      .on("set", this.setPromise(this.setColorTemperature))

    if (accessory.context.model === "ceiling5") {
      this.moonlight =
        this.accessory.getService(this.platform.Service.Switch) ||
        this.accessory.addService(this.platform.Service.Switch)

      this.moonlight
        .getCharacteristic(this.platform.Characteristic.On)
        .on("get", this.getPromise(this.getActiveMode))
        .on("set", this.setPromise(this.setActiveMode))
    }

    if (accessory.context.support.includes("set_rgb")) {
      this.lightbulb.getCharacteristic(this.platform.Characteristic.Hue).on(
        "set",
        this.setPromise(async (value) => {
          await this.device.connect()
          await this.device.command("set_hsv", [
            value as number,
            this.lightbulb.getCharacteristic(
              this.platform.Characteristic.Saturation
            ).value as number,
            "smooth",
            500,
          ])
          return value
        })
      )

      this.lightbulb
        .getCharacteristic(this.platform.Characteristic.Saturation)
        .on(
          "set",
          this.setPromise(async (value) => {
            await this.device.connect()
            await this.device.command("set_hsv", [
              this.lightbulb.getCharacteristic(this.platform.Characteristic.Hue)
                .value as number,
              value as number,
              "smooth",
              500,
            ])
            return value
          })
        )
    }

    this.device.connect().then(() => {
      this.device.on("notification", (value) => {
        if (value?.bright) {
          const brightness = Number(value?.bright) as CharacteristicValue

          if (
            this.lightbulb.getCharacteristic(
              this.platform.Characteristic.Brightness
            ).value !== brightness
          ) {
            this.lightbulb.updateCharacteristic(
              this.platform.Characteristic.Brightness,
              brightness
            )
          }
        }
      })
    })
  }

  private getPromise = (inner: () => Promise<CharacteristicValue>) => {
    return async (callback: CharacteristicGetCallback) => {
      try {
        callback(null, await inner())
      } catch (err) {
        this.platform.log.error(err)
        callback(err)
      }
    }
  }

  private setPromise = (
    inner: (value: CharacteristicValue) => Promise<CharacteristicValue>
  ) => {
    return async (
      value: CharacteristicValue,
      callback: CharacteristicSetCallback
    ) => {
      try {
        callback(null, await inner(value))
      } catch (err) {
        this.platform.log.error(err)
        callback(err)
      }
    }
  }

  getColorTemperature = async () => {
    await this.device.connect()
    const response = await this.device.command("get_prop", ["ct"])
    return transform(
      Number(response.shift()) as number,
      [2700, 5700],
      [500, 140]
    )
  }

  setColorTemperature = async (value: CharacteristicValue) => {
    await this.device.connect()
    await this.device.command("set_ct_abx", [
      transform(value as number, [140, 500], [5700, 2700]),
      "smooth",
      500,
    ])

    return value
  }

  getPower = async () => {
    await this.device.connect()
    const response = await this.device.command("get_prop", ["power"])
    return response.includes("on") as CharacteristicValue
  }

  setPower = async (value: CharacteristicValue) => {
    await this.device.connect()
    await this.device.command("set_power", [(value as boolean) ? "on" : "off"])
    return value
  }

  getBrightness = async () => {
    await this.device.connect()
    const response = await this.device.command("get_prop", ["bright"])
    return Number(response.shift()) as CharacteristicValue
  }

  setBrightness = async (value: CharacteristicValue) => {
    await this.device.connect()
    await this.device.command("set_bright", [value as number, "smooth", 500])
    return value
  }

  getActiveMode = async () => {
    await this.device.connect()
    const response = await this.device.command("get_prop", ["active_mode"])
    return response.includes("0")
  }

  setActiveMode = async (value: CharacteristicValue) => {
    await this.device.connect()
    await this.device.command("set_power", ["on", "smooth", 500, value ? 1 : 5])
    return value
  }
}
