import { API } from "homebridge"

import { PLATFORM_NAME } from "./settings"
import { ExampleHomebridgePlatform } from "./platform"

/**
 * This method registers the platform with Homebridge
 */
export const module = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, ExampleHomebridgePlatform)
}
