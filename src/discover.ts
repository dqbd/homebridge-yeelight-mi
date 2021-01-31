import * as dgram from "dgram"
import EventEmitter from "events"
import { lstat } from "fs"
import TypedEmitter from "typed-emitter"

interface DiscoverEvents {
  start: () => void
}

export class Discover extends (EventEmitter as new () => TypedEmitter<DiscoverEvents>) {
  socket: dgram.Socket

  constructor() {
    super()
    this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true })
  }

  listen() {
    this.socket.on("message", (response) => {
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
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {})

      console.log(tags)
    })

    this.socket.on("listening", () => {
      const message = Buffer.from(
        [
          `M-SEARCH * HTTP/1.1`,
          `HOST: 239.255.255.250:1982`,
          `MAN: "ssdp:discover"`,
          `ST: wifi_bulb`,
        ]
          .map((i) => i + "\r\n")
          .join("")
      )

      // this.socket.setBroadcast(true)
      // this.socket.setMulticastTTL(128)
      // this.socket.addMembership("239.255.255.250")

      this.socket.send(message, 1982, "239.255.255.250")
    })

    this.socket.bind({ port: 0, exclusive: true })
  }
}

const discover = new Discover()
discover.listen()
