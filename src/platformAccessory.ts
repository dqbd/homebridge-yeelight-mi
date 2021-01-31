import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from "homebridge"

import { YeelightMiHomebridgePlatform } from "./platform"
import { Device } from "./yeelight/device"
import { DiscoverDevice } from "./yeelight/discover"

export class YeelightMiPlatformAccessory {
  private service: Service
  private device: Device

  private exampleStates = {
    On: false,
    Brightness: 100,
  }

  constructor(
    private readonly platform: YeelightMiHomebridgePlatform,
    private readonly accessory: PlatformAccessory<DiscoverDevice>
  ) {
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

    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb)

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.name
    )

    this.device = new Device(
      this.platform.log,
      accessory.context.host,
      accessory.context.port
    )

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on(
        "set",
        async (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
          try {
            await this.device.connect()
            await this.device.command(
              "set_power",
              (value as boolean) ? ["on"] : ["off"]
            )

            cb(null, value)
          } catch (err) {
            this.platform.log.error(err)
            cb(err)
          }
        }
      )
      .on("get", async (cb: CharacteristicGetCallback) => {
        try {
          await this.device.connect()
          const response = await this.device.command("get_prop", ["power"])

          this.platform.log.debug(String(response))

          cb(null, true)
        } catch (err) {
          this.platform.log.error(err)
          cb(err)
        }
      })

    // 

    // register handlers for the Brightness Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .on("set", this.setBrightness.bind(this)) // SET - bind to the 'setBrightness` method below
  }

  setBrightness(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback
  ) {
    // implement your own code to set the brightness
    this.exampleStates.Brightness = value as number

    this.platform.log.debug("Set Characteristic Brightness -> ", value)

    // you must call the callback function
    callback(null)
  }
}
