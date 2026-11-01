# Hosting the relay

Ready to install? See [Choose your setup](START-HERE.md) and the [installation guide](SAMSUNG-TIZEN.md).

The relay is the always-on part: a small Node.js program plus FFmpeg that pulls the camera stream, converts it and sends it to the TV. It can share a computer with Home Assistant if there's spare memory and CPU. For Samsung TVs it must listen on your LAN, because the TV app connects to it directly.

## Choose where to run it

| Existing setup | How to host the relay | Status for Samsung |
|---|---|---|
| Home Assistant in Docker on a Raspberry Pi or other Linux computer | Native relay as a systemd service on the same computer | **Tested** on a Raspberry Pi Zero 2 W, with limits (below) |
| Linux computer or NAS with Docker | The supplied Compose service plus `compose.tizen.yaml` | Not yet tested with a Samsung TV |
| Home Assistant OS in a virtual machine | The relay on the host or in a separate VM or container, not inside the HA VM | Not yet tested |
| Home Assistant OS installed directly on its hardware | Use another computer for the relay | HA OS doesn't let you install the relay, and the project's experimental HA OS package is LG-only and untested |
| Another always-on computer | Native relay or Docker | Works the same way; useful when the Home Assistant machine is small |

Don't install Node or FFmpeg inside Home Assistant's own container.

## Hardware

**There's no benchmarked minimum.** The tested installation and these starting points are a guide, not a capacity rating.

| Host | Experience so far |
|---|---|
| Raspberry Pi Zero 2 W (512 MB), also running Home Assistant in Docker | **Works, but at the limit.** About 90 MB of memory was available before the relay started, with swap nearly full. The relay stopped answering once during testing and needed a restart; the cause wasn't captured. The setup in the guide makes the kernel stop the relay before Home Assistant if memory runs out |
| Raspberry Pi 4 or 5, 2 GB or more | Not tested; the more comfortable Pi choice |
| x86 mini-PC or NAS, 4 cores, 8 GB | Not tested with Samsung; the upstream project's suggested starting point for a shared host |

If you're buying hardware, don't plan around a Pi Zero 2 W. If you already have one, try it with a low-resolution camera sub-stream and keep an eye on memory.

The relay needs Node.js 22 or newer and FFmpeg with the `mpeg1video` encoder. The guide uses a static FFmpeg build for the Pi; Docker supplies its own. It needs no GPU and no Internet-facing port. It doesn't record video, so disk use is just the software and logs.

## What determines the load

- Output is 768×432 at 25 fps, MPEG-1. A 4K or HEVC camera stream costs much more to decode without improving the picture, so use a sub-stream.
- One FFmpeg runs per camera being shown. TVs watching the same camera share it.
- **FFmpeg starts as soon as Home Assistant sends a request,** so the stream is ready when the TV connects. It stops when no TV is watching, at the latest 20 seconds after the request if no TV connects, and never runs longer than 95 seconds.
- Decoding and encoding are in software. Hardware acceleration isn't implemented on Linux.
- The Docker service has a 512 MiB memory limit. That's a configured cap, not a measured requirement.

## Check a shared host before relying on it

1. Start with one camera sub-stream and manual tests. Leave automatic alerts off.
2. While a picture is showing, check `free -m` and the CPU load, and that Home Assistant still responds. Afterwards, check FFmpeg has stopped: `pgrep -a ffmpeg` should print nothing about 30 seconds after the picture closes.
3. Look for out-of-memory kills: `journalctl -k | grep -i "out of memory"`.
4. Repeat while the host is busy, for example during a Home Assistant backup.
5. If Home Assistant slows down or the relay stops answering, use a lighter camera stream or move the relay to a bigger computer.
