/* eslint-disable @typescript-eslint/no-explicit-any */

import * as net from "net"
import EventEmitter from "events"
import TypedEmitter from "typed-emitter"
import { Logger } from "homebridge"

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
  set_power: ["off"] | ["on"] | ["on", "sudden" | "smooth", number, number]
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

export class Device extends (EventEmitter as new () => TypedEmitter<DeviceEvents>) {
  socket?: net.Socket

  state?: DeviceState = DeviceState.DISCONNECTED

  timer?: NodeJS.Timeout | null = null
  failedCount = 0

  counter = new Counter()

  constructor(
    public readonly log: Logger,
    public readonly host: string,
    public readonly port: number
  ) {
    super()

    this.log.debug(`Device scoket created @ ${host}:${port}`)
  }

  private createSocket() {
    this.socket = new net.Socket()
    this.socket.on("data", (data) => {
      try {
        // TODO: handle parsing of multiple payloads values
        const response = JSON.parse(data.toString("utf-8"))
        if (response?.method === "props") {
          this.emit("notification", response?.params)
        }
      } catch (error) {
        this.log.error("Error whiile parsing notification", error)
      }
    })
  }

  async connect() {
    this.log.debug(`Connecting to device @ ${this.host}:${this.port}`)
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
  ): Promise<string[]> {

    this.log.debug("Executing command", method, `on device ${this.host}:${this.port}`)
    if (!this.socket || this.state === DeviceState.DISCONNECTED) {
      throw new Error("Socket is not connected")
    }

    const id = this.counter.value

    const response = new Promise<string[]>((resolve, reject) => {
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
          this.log.error(error, data.toString("utf-8"))
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
