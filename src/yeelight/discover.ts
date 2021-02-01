import * as dgram from "dgram"
import EventEmitter from "events"
import { Logger } from "homebridge"
import TypedEmitter from "typed-emitter"

interface DiscoverEvents {
  device: (device: DiscoverDevice) => void
}

export interface DiscoverDevice {
  host: string
  port: number
  id: string
  model: string
  fw_ver: string
  support: string[]
  power: string
  bright: string
  color_mode: string
  ct: string
  rgb: string
  hue: string
  sat: string
  name: string
}

export class Discover extends (EventEmitter as new () => TypedEmitter<DiscoverEvents>) {
  socket: dgram.Socket
  timer: NodeJS.Timer | null = null

  constructor(private readonly log: Logger) {
    super()
    this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true })
  }

  private broadcast() {
    this.socket.send(
      Buffer.from(
        [
          `M-SEARCH * HTTP/1.1`,
          `HOST: 239.255.255.250:1982`,
          `MAN: "ssdp:discover"`,
          `ST: wifi_bulb`,
        ]
          .map((i) => i + "\r\n")
          .join("")
      ),
      1982,
      "239.255.255.250"
    )
  }

  private scheduleBroadcast(delay: number) {
    this.log.debug("Sending device search request")
    this.broadcast()

    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.scheduleBroadcast(delay), delay)
  }

  listen() {
    this.log.debug("Listening for devices")
    this.socket.on("message", (response, raddr) => {
      const tags = response
        .toString("utf-8")
        .split("\n")
        .map((item) =>
          item
            .trim()
            .split(":", 2)
            .map((i) => i.trim())
        )
        .filter((list) => list.length === 2)
        .reduce<{ [key: string]: string }>((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      this.emit("device", {
        host: raddr.address,
        port: 55443,
        id: tags.id ?? "",
        model: tags.model ?? "",
        fw_ver: tags.fw_ver ?? "",
        support: tags.support?.split(" ") ?? [],
        power: tags.power ?? "",
        bright: tags.bright ?? "",
        color_mode: tags.color_mode ?? "",
        ct: tags.ct ?? "",
        rgb: tags.rgb ?? "",
        hue: tags.hue ?? "",
        sat: tags.sat ?? "",
        name: tags.name ?? "",
      })
    })

    this.socket.on("listening", () => {
      this.socket.setBroadcast(true)
      this.socket.setMulticastTTL(128)
      this.socket.addMembership("239.255.255.250")

      this.scheduleBroadcast(5 * 60 * 1000)
    })

    this.socket.bind({ port: 0, exclusive: true })
  }

  destroy() {
    this.log.debug("Stopping listening for new devices")
    if (this.timer) clearTimeout(this.timer)
    this.socket.close()
  }
}
