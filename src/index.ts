import { API } from "homebridge"

import { PLATFORM_NAME } from "./settings"
import { YeelightMiHomebridgePlatform } from "./platform"

module.exports = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, YeelightMiHomebridgePlatform)
}
