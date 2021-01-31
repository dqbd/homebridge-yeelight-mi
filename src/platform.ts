import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from "homebridge"

import { PLATFORM_NAME, PLUGIN_NAME } from "./settings"
import { YeelightMiPlatformAccessory } from "./platformAccessory"
import { Discover, DiscoverDevice } from "./yeelight/discover"

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class YeelightMiHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic

  // this is used to track restored cached accessories
  public readonly accessories: {
    [key: string]: {
      instance: PlatformAccessory<DiscoverDevice>
      init: boolean
    }
  } = {}

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.log.debug("Finished initializing platform:", this.config.name)

    this.api.on("didFinishLaunching", () => {
      this.registerAccessories()
    })
  }

  configureAccessory(accessory: PlatformAccessory<DiscoverDevice>) {
    this.log.info("Loading accessory from cache:", accessory.displayName)
    this.accessories[accessory.UUID] = {
      instance: accessory,
      init: false,
    }
  }

  registerAccessories() {
    this.log.debug("Registering accessories")

    const discover = new Discover()
    discover.listen()

    // figure out the device's address and port
    discover.on("device", (device) => {
      const uuid = this.api.hap.uuid.generate(device.id)
      const displayName = [device.id, device.model].join("-")

      this.log.debug("Device notify received:", displayName)

      if (this.accessories[uuid]) {
        const existing = this.accessories[uuid]
        existing.instance.context = device

        if (!existing.init) {
          new YeelightMiPlatformAccessory(this, existing.instance)
          this.api.updatePlatformAccessories([existing.instance])
        }

        existing.init = true
      } else {
        const instance: PlatformAccessory<DiscoverDevice> = new this.api.platformAccessory(
          displayName,
          uuid
        )

        new YeelightMiPlatformAccessory(this, instance)
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          instance,
        ])
        this.accessories[uuid] = { instance, init: true }
      }
    })
  }
}
