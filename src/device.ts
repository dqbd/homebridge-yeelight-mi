/* eslint-disable @typescript-eslint/no-explicit-any */

import * as net from "net"
import EventEmitter from "events"
import TypedEmitter from "typed-emitter"

enum DeviceState {
  CONNECTED,
  DISCONNECTED,
}

interface YeelightCommandList {
  get_prop: (
    | "power"
    | "bright"
    | "ct"
    | "rgb"
    | "hue"
    | "sat"
    | "color_mode"
    | "flowing"
    | "delayoff"
    | "flow_params"
    | "music_on"
    | "name"
    | "bg_power"
    | "bg_flowing"
    | "bg_flow_params"
    | "bg_ct"
    | "bg_lmode"
    | "bg_bright"
    | "bg_rgb"
    | "bg_hue"
    | "bg_sat"
    | "nl_br"
    | "active_mode"
  )[]
  set_ct_abx: [number, "sudden" | "smooth", number]
  set_rgb: [number, "sudden" | "smooth", number]
  set_hsv: [number, number, "sudden" | "smooth", number]
  set_bright: [number, "sudden" | "smooth", number]
  set_power: ["off"] | ["on"]
  toggle: []
  set_default: []
  set_adjust: ["increase" | "decrease" | "circle", "bright" | "ct" | "color"]
  adjust_bright: [number, number]
  adjust_ct: [number, number]
  adjust_color: [number, number]
}

interface DeviceEvents {
  notification: (value?: { [key: string]: any }) => void
}

class Counter {
  _value = 0

  get value() {
    this._value += 1
    return this._value
  }

  reset() {
    this._value = 0
  }
}

class Device extends (EventEmitter as new () => TypedEmitter<DeviceEvents>) {
  socket?: net.Socket
  host?: string
  port?: number

  state?: DeviceState = DeviceState.DISCONNECTED

  timer?: NodeJS.Timeout | null = null
  failedCount = 0

  counter = new Counter()

  constructor(host: string, port: number) {
    super()

    this.host = host
    this.port = port
  }

  private createSocket() {
    this.socket = new net.Socket()
    this.socket.on("data", (data) => {
      try {
        const response = JSON.parse(data.toString("utf-8"))
        if (response?.method === "props") {
          this.emit("notification", response?.params)
        }
      } catch (error) {
        console.log("Error whiile parsing notification", error)
      }
    })
  }

  async connect() {
    if (!this.socket || this.socket.destroyed) {
      this.createSocket()
    }

    if (this.state === DeviceState.CONNECTED) {
      return
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.host || !this.port) {
        return reject(new Error("Missing host or port"))
      }

      this.socket?.once("error", (error) => {
        this.state = DeviceState.DISCONNECTED
        return reject(error)
      })

      this.socket?.connect({ host: this.host, port: this.port }, () => {
        this.state = DeviceState.CONNECTED
        return resolve()
      })
    })
  }

  async disconnect() {
    if (this.socket && !this.socket?.destroyed) {
      this.socket?.destroy()
    }

    this.state = DeviceState.DISCONNECTED
  }

  async command<TKey extends keyof YeelightCommandList>(
    method: TKey,
    parameters: YeelightCommandList[TKey]
  ) {
    if (!this.socket || this.state === DeviceState.DISCONNECTED) {
      throw new Error("Socket is not connected")
    }

    const id = this.counter.value

    const response = new Promise((resolve, reject) => {
      const listener = (data: Buffer) => {
        try {
          const payload = JSON.parse(data.toString("utf-8"))

          if (payload?.id === id) {
            if (payload?.result && !payload?.error) {
              return resolve(payload?.result)
            }

            // TODO: handle network change
            return reject(payload?.error ?? "Missing error message")
          }

          this.socket?.once("data", listener)
        } catch (error) {
          return reject(error)
        }
      }

      this.socket?.once("data", listener)
    })

    this.socket.write(
      JSON.stringify({ id, method, params: parameters }) + "\r\n"
    )
    return response
  }
}

;(async () => {
  const device = new Device("172.16.1.203", 55443)

  try {
    await device.connect()

    console.log(await device.command(42, "set_power", ["off"]))

    // console.log(await device.command(42, "set_power", ["on"]))

    // console.log(
    //   await device.command(42, "get_prop", [
    //     "ct",
    //     "rgb",
    //     "hue",
    //     "sat",
    //     "color_mode",
    //     "flowing",
    //     "delayoff",
    //     "name",
    //     "active_mode",
    //     "bright",
    //   ])
    // )

    // // range [2700, 5700]
    // console.log(await device.command(35, "set_ct_abx", [2700, "smooth", 500]))

    // await device.disconnect()
  } catch (error) {
    console.log("Error:", error)
  } finally {
    // await device.disconnect()
  }
})()
