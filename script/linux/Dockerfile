# syntax=docker/dockerfile:1
# Linux build environment for the GitHub Desktop Linux port.
# Build with: docker buildx build --builder gd-linux-builder --platform linux/amd64 --load -t gd-linux script/linux
FROM ubuntu:22.04

ARG NODE_VERSION=24.15.0
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 python3-setuptools pkg-config git file curl ca-certificates xz-utils unzip \
    dpkg dpkg-dev fakeroot rpm \
    libsecret-1-dev libkrb5-dev \
    libnss3 libgtk-3-0 libxss1 libasound2 libgbm1 libxkbcommon0 libdrm2 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 \
    libcairo2 libx11-xcb1 libxtst6 libnotify4 libxcb-dri3-0 libsecret-1-0 xdg-utils \
    xvfb xauth libfuse2 desktop-file-utils lintian \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
 && rm /tmp/node.tar.xz \
 && node --version

# The repo vendors yarn 1.21.1 (see .yarnrc yarn-path); expose a `yarn` that runs it.
RUN printf '#!/bin/sh\nexec node /work/vendor/yarn-1.21.1.js "$@"\n' > /usr/local/bin/yarn && chmod +x /usr/local/bin/yarn

RUN printf '#!/bin/sh\nexec /usr/bin/gcc -U_FORTIFY_SOURCE "$@"\n' > /usr/local/bin/gcc-nofortify && chmod +x /usr/local/bin/gcc-nofortify

RUN printf '#!/bin/sh\nexec /usr/bin/g++ -U_FORTIFY_SOURCE "$@" -std=gnu++17\n' > /usr/local/bin/g++-cxx17 && chmod +x /usr/local/bin/g++-cxx17

RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

RUN useradd -m -u 1000 -s /bin/bash builder \
 && mkdir -p /work /home/builder/.cache/electron /home/builder/.cache/yarn /home/builder/.cache/npm \
 && chown -R builder:builder /work /home/builder/.cache

USER builder
# vendor/printenvz builds with -Werror -D_FORTIFY_SOURCE=1, which clashes with Ubuntu's
# default -D_FORTIFY_SOURCE=2; the CC wrapper undefines it before gyp's flags apply.
# The CXX wrapper forces C++17: the old node-addon-api in fs-admin does not compile as C++20
# (Node 24's gyp default); the flag goes last so it overrides gyp's -std.
ENV CC=/usr/local/bin/gcc-nofortify \
    CXX=/usr/local/bin/g++-cxx17 \
    HOME=/home/builder \
    ELECTRON_CACHE=/home/builder/.cache/electron \
    npm_config_cache=/home/builder/.cache/npm
WORKDIR /work
CMD ["bash"]
