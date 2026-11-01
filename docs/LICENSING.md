# Licensing and dependency boundaries

Own project code is GPL-3.0-only. Keep `LICENSE` and the notices when redistributing it.

**The Samsung TV app** (`tizen/`) includes `LICENSE`, `NOTICE` and the original MIT JSMpeg licence (`tizen/vendor/JSMpeg-LICENSE.txt`). Its `jsmpeg.min.js` is byte-for-byte the same build as the LG app's. JSMpeg's MIT licence is unchanged. This project doesn't publish a built `.wgt`. Each one is built by its user, because it contains that user's relay token and is signed with their own Samsung certificate. If you share a built package with someone, include the project source or say where to get it, as GPL-3.0 requires. Share it only if you're happy to share the token inside it.

**Tizen Studio**, the `tizen` and `sdb` tools, and the Samsung Certificate Extension are Samsung's software under Samsung's terms. They aren't included in or redistributed by this project. You install them yourself from Samsung.

**Runtime npm dependencies** are installed from the lockfile and keep their own notices. `npm audit --omit=dev` reported no vulnerabilities on 1 November 2026.

**FFmpeg:** the project doesn't distribute an FFmpeg executable or a container image.
- The Docker route installs Debian's FFmpeg package during your own local build.
- The Raspberry Pi route in the guide downloads a third-party static build (johnvansickle.com) to your own computer.

FFmpeg's licence depends on how it was built; [FFmpeg's legal page](https://ffmpeg.org/legal.html) explains the LGPL/GPL distinction. If you redistribute an FFmpeg binary or a built container, keep its notices and provide the source and build information its licence requires. This project's GPL licence doesn't cover that for you.

**LG tooling:** the `tooling/` folder contains the official webOS CLI used by the LG version. It's not needed for Samsung and isn't used by the relay. Its own dependency-audit limits are described in the [upstream licensing notes](https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/docs/LICENSING.md).
